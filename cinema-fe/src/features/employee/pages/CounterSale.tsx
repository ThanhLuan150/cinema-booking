import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMySchedules } from '../hooks/useMySchedules';
import { useScheduleSeats } from '../hooks/useScheduleSeats';
import { useCreateCounterSale } from '../hooks/useCounterSale';
import { findAccountByEmail } from '../api/employee.api';
import { CounterSaleSeatGrid } from '../components/CounterSaleSeatGrid';
import { CounterSaleCustomerLookup } from '../components/CounterSaleCustomerLookup';

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
        <CounterSaleSeatGrid tickets={tickets} selectedTicketIds={selectedTicketIds} onToggleTicket={toggleTicket} />
      )}

      <CounterSaleCustomerLookup
        email={email}
        customerAccountId={customerAccountId}
        lookingUp={lookingUp}
        onEmailChange={(value) => {
          setEmail(value);
          setCustomerAccountId(null);
        }}
        onFindCustomer={handleFindCustomer}
      />

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
