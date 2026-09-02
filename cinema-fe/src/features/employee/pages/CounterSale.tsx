import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { cn } from '@/lib/cn';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMySchedules } from '../hooks/useMySchedules';
import { useScheduleSeats } from '../hooks/useScheduleSeats';
import { useCreateCounterSale } from '../hooks/useCounterSale';
import { findAccountByEmail } from '../api/employee.api';

function CounterSale() {
  const { t } = useTranslation('employee');
  const [searchParams] = useSearchParams();
  const { data: currentUser } = useCurrentUser();
  const { data: schedulesPage, isLoading } = useMySchedules();
  const { data: moviesPage } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const movieNameById = useMemo(
    () => new Map((moviesPage?.data ?? []).map((movie) => [movie.id, movie.name])),
    [moviesPage],
  );

  const [scheduleId, setScheduleId] = useState(searchParams.get('scheduleId') ?? '');
  const [selectedTicketIds, setSelectedTicketIds] = useState<number[]>([]);
  const [email, setEmail] = useState('');
  const [customerAccountId, setCustomerAccountId] = useState<number | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const { data: tickets } = useScheduleSeats(scheduleId || null);
  const createCounterSaleMutation = useCreateCounterSale();

  const scheduleOptions = useMemo(
    () =>
      (schedulesPage?.data ?? []).map((s) => ({
        label: `${movieNameById.get(s.movie_id) ?? s.movie_id} — ${s.movie_date} ${s.time_begin}`,
        value: s.id,
      })),
    [schedulesPage, movieNameById],
  );

  // Seat prices come from the backend (Pricing Rule engine) via the scheduleSeats response —
  // never recomputed here, so the frontend never hardcodes a seat-type price multiplier.
  const totalPrice = useMemo(() => {
    if (!tickets) return 0;
    return tickets
      .filter((ticket) => selectedTicketIds.includes(ticket.id))
      .reduce((sum, ticket) => sum + (ticket.price ?? 0), 0);
  }, [tickets, selectedTicketIds]);

  const toggleTicket = useCallback((ticketId: number) => {
    setSelectedTicketIds((current) =>
      current.includes(ticketId) ? current.filter((id) => id !== ticketId) : [...current, ticketId],
    );
  }, []);

  const handleFindCustomer = useCallback(async () => {
    if (!email) return;
    setLookingUp(true);
    try {
      const account = await findAccountByEmail(email);
      setCustomerAccountId(account.id);
      toast.success(t('counterSale.customerFound'));
    } catch {
      setCustomerAccountId(null);
      toast.error(t('counterSale.customerNotFound'));
    } finally {
      setLookingUp(false);
    }
  }, [email, t]);

  const handleSubmit = useCallback(async () => {
    if (!scheduleId || selectedTicketIds.length === 0 || !customerAccountId || !currentUser?.cinema_id) return;
    try {
      await createCounterSaleMutation.mutateAsync({
        ticketIds: selectedTicketIds,
        comboIds: [],
        voucherCode: null,
        discountAmount: 0,
        totalPrice,
        accountId: customerAccountId,
        cinema_id: currentUser.cinema_id,
      });
      toast.success(t('counterSale.saleSuccess'));
      setSelectedTicketIds([]);
      setEmail('');
      setCustomerAccountId(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  }, [scheduleId, selectedTicketIds, customerAccountId, currentUser, totalPrice, createCounterSaleMutation, t]);

  return (
    <AdminLayout breadcrumb={t('counterSale.breadcrumb')} loading={isLoading}>
      <div className="max-w-md">
        <Select
          label={t('counterSale.scheduleLabel')}
          value={scheduleId}
          onChange={(e) => {
            setScheduleId(e.target.value);
            setSelectedTicketIds([]);
          }}
          placeholder={t('counterSale.schedulePlaceholder')}
          options={scheduleOptions}
        />
      </div>

      {scheduleId && (
        <div className="mt-6">
          <h6 className="mb-3 font-semibold text-white">{t('counterSale.seatsTitle')}</h6>
          {!tickets || tickets.length === 0 ? (
            <EmptyState title={t('counterSale.noSeats')} />
          ) : (
            <div className="flex flex-wrap gap-2">
              {tickets.map((ticket) => {
                const isAvailable = ticket.status === 1;
                const isSelected = selectedTicketIds.includes(ticket.id);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => toggleTicket(ticket.id)}
                    className={cn(
                      'h-9 min-w-[2.5rem] rounded px-2 text-xs font-medium text-white transition-opacity',
                      SEAT_TYPE_CLASS[ticket.seat_type] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard],
                      !isAvailable && 'cursor-not-allowed opacity-30',
                      isSelected && 'ring-2 ring-accent',
                    )}
                  >
                    {ticket.seat_code}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 max-w-md">
        <h6 className="mb-3 font-semibold text-white">{t('counterSale.customerTitle')}</h6>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder={t('counterSale.customerEmailPlaceholder')}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setCustomerAccountId(null);
            }}
          />
          <Button type="button" variant="secondary" loading={lookingUp} onClick={handleFindCustomer}>
            {t('counterSale.findCustomer')}
          </Button>
        </div>
        {customerAccountId && <p className="mt-2 text-sm text-emerald-400">{t('counterSale.customerFound')}</p>}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <p className="text-lg font-bold text-accent">
          {t('counterSale.total')}: {totalPrice.toLocaleString()}đ
        </p>
        <Button
          type="button"
          variant="danger"
          loading={createCounterSaleMutation.isPending}
          disabled={!scheduleId || selectedTicketIds.length === 0 || !customerAccountId}
          onClick={handleSubmit}
        >
          {t('counterSale.submit')}
        </Button>
      </div>
    </AdminLayout>
  );
}

export default CounterSale;
