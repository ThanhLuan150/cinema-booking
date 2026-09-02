import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useCombos } from '@/features/booking/hooks/useCombos';
import { useHoldSeats } from '@/features/booking/hooks/useHoldSeats';
import { useReleaseSeats } from '@/features/booking/hooks/useReleaseSeats';
import { useBookingSearchByCode } from '../hooks/useBookingSearchByCode';
import { cn } from '@/lib/cn';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';
import { TICKET_STATUS } from '@/constants/ticketStatus';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMySchedules } from '../hooks/useMySchedules';
import { useScheduleSeats } from '../hooks/useScheduleSeats';
import { useBoxOfficeSell } from '../hooks/useBoxOfficeSell';
import { useBoxOfficeBookingTickets } from '../hooks/useBoxOfficeBookingTickets';
import { findAccountByEmail } from '../api/employee.api';
import type { BoxOfficePaymentMethod, BoxOfficeSellResult } from '../types/boxOffice.types';

const PAYMENT_METHODS: BoxOfficePaymentMethod[] = ['CASH', 'CARD', 'QR_PAYMENT'];

function TicketReceipt({ bookingId, onPrint }: { bookingId: number; onPrint: () => void }) {
  const { t } = useTranslation('employee');
  const { data } = useBoxOfficeBookingTickets(bookingId);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-card print:border-none print:shadow-none">
      <div className="mb-4 flex items-center justify-between">
        <h6 className="font-semibold text-white">{t('boxOffice.receipt.title')}</h6>
        <Button type="button" variant="secondary" onClick={onPrint} className="print:hidden">
          {t('boxOffice.receipt.print')}
        </Button>
      </div>
      {!data ? (
        <p className="text-sm text-txt/60">{t('boxOffice.receipt.loading')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.tickets.map((ticket) => (
            <div key={ticket.ticket_id} className="flex items-center gap-4 rounded-lg border border-border-strong p-4">
              {ticket.qr_token && <QRCodeSVG value={ticket.qr_token} size={72} />}
              <div className="min-w-0 text-sm">
                <p className="truncate font-semibold text-white">{ticket.movie?.name}</p>
                <p className="text-txt/70">
                  {ticket.schedule?.movie_date} {ticket.schedule?.time_begin}
                </p>
                <p className="text-txt/70">{t('boxOffice.receipt.seat', { code: ticket.seat_code })}</p>
                <p className="text-txt/70">{data.booking.code}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BoxOffice() {
  const { t } = useTranslation('employee');
  const [searchParams] = useSearchParams();
  const { data: currentUser } = useCurrentUser();
  const { data: schedulesPage } = useMySchedules();
  const { data: moviesPage } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const movieNameById = useMemo(
    () => new Map((moviesPage?.data ?? []).map((movie) => [movie.id, movie.name])),
    [moviesPage],
  );

  const [scheduleId, setScheduleId] = useState(searchParams.get('scheduleId') ?? '');
  const [movieId, setMovieId] = useState('');
  const [selectedSeatCodes, setSelectedSeatCodes] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [comboIds, setComboIds] = useState<number[]>([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [method, setMethod] = useState<BoxOfficePaymentMethod>('CASH');
  const [email, setEmail] = useState('');
  const [customerAccountId, setCustomerAccountId] = useState<number | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lastSale, setLastSale] = useState<BoxOfficeSellResult | null>(null);
  const [searchCode, setSearchCode] = useState('');

  const { data: tickets, refetch: refetchSeats } = useScheduleSeats(scheduleId || null);
  const { data: combos = [] } = useCombos(currentUser?.cinema_id ?? null);
  const holdSeatsMutation = useHoldSeats(scheduleId || null);
  const releaseSeatsMutation = useReleaseSeats(scheduleId || null);
  const sellMutation = useBoxOfficeSell();

  const schedules = useMemo(() => schedulesPage?.data ?? [], [schedulesPage]);

  // Chọn Movie -> Chọn Showtime: the movie list is only the movies actually playing at this
  // employee's own branch (derived from their own schedules), not the full catalog.
  const movieOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const s of schedules) {
      if (!seen.has(s.movie_id)) seen.set(s.movie_id, movieNameById.get(s.movie_id) ?? String(s.movie_id));
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ label: name, value: id }));
  }, [schedules, movieNameById]);

  const scheduleOptions = useMemo(
    () =>
      schedules
        .filter((s) => !movieId || String(s.movie_id) === movieId)
        .map((s) => ({ label: `${s.movie_date} ${s.time_begin}`, value: s.id })),
    [schedules, movieId],
  );

  // Keeps the movie dropdown in sync when a showtime arrives preselected via ?scheduleId=.
  useEffect(() => {
    if (!scheduleId || movieId) return;
    const schedule = schedules.find((s) => String(s.id) === scheduleId);
    if (schedule) setMovieId(String(schedule.movie_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, scheduleId]);

  const lockedTickets = useMemo(
    () => (tickets ?? []).filter((ticket) => selectedSeatCodes.includes(ticket.seat_code)),
    [tickets, selectedSeatCodes],
  );
  const seatTotal = useMemo(() => lockedTickets.reduce((sum, t) => sum + (t.price ?? 0), 0), [lockedTickets]);
  const comboTotal = useMemo(
    () => combos.filter((c) => comboIds.includes(c.id)).reduce((sum, c) => sum + c.price, 0),
    [combos, comboIds],
  );
  const estimatedTotal = seatTotal + comboTotal;

  // Tracked via a ref (rather than as an effect dependency) so the cleanup below always reads
  // the *latest* lock state at the moment the schedule actually changes or the page unmounts,
  // instead of the stale state captured back when this effect instance was first set up.
  const lockedSeatsRef = useRef({ locked, selectedSeatCodes });
  useEffect(() => {
    lockedSeatsRef.current = { locked, selectedSeatCodes };
  }, [locked, selectedSeatCodes]);

  // Releases whatever this cashier is holding when they switch showtimes or leave the page
  // without completing the sale — a seat must never stay locked by an abandoned attempt.
  useEffect(() => {
    return () => {
      const { locked: isLocked, selectedSeatCodes: codes } = lockedSeatsRef.current;
      if (isLocked && codes.length > 0) {
        releaseSeatsMutation.mutate(codes);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId]);

  const resetSeatSelection = useCallback(() => {
    setSelectedSeatCodes([]);
    setLocked(false);
    setComboIds([]);
    setVoucherCode('');
    setPromotionCode('');
    setEmail('');
    setCustomerAccountId(null);
  }, []);

  const toggleSeat = useCallback(
    (seatCode: string) => {
      if (locked) return;
      setSelectedSeatCodes((current) =>
        current.includes(seatCode) ? current.filter((code) => code !== seatCode) : [...current, seatCode],
      );
    },
    [locked],
  );

  const handleLockSeats = useCallback(async () => {
    if (!scheduleId || selectedSeatCodes.length === 0) return;
    try {
      await holdSeatsMutation.mutateAsync(selectedSeatCodes);
      setLocked(true);
      await refetchSeats();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
      await refetchSeats();
    }
  }, [scheduleId, selectedSeatCodes, holdSeatsMutation, refetchSeats, t]);

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

  const orderSignature = useMemo(
    () =>
      JSON.stringify({
        scheduleId,
        ticketIds: lockedTickets.map((t) => t.id).sort(),
        comboIds: [...comboIds].sort(),
        voucherCode,
        promotionCode,
        method,
        customerAccountId,
      }),
    [scheduleId, lockedTickets, comboIds, voucherCode, promotionCode, method, customerAccountId],
  );
  const idempotencyKeyRef = useRef<{ key: string; forOrder: string } | null>(null);
  const getIdempotencyKey = () => {
    if (idempotencyKeyRef.current?.forOrder !== orderSignature) {
      idempotencyKeyRef.current = { key: crypto.randomUUID(), forOrder: orderSignature };
    }
    return idempotencyKeyRef.current.key;
  };

  const handleSubmit = useCallback(async () => {
    if (!scheduleId || lockedTickets.length === 0 || !customerAccountId || !currentUser?.cinema_id) return;
    try {
      const result = await sellMutation.mutateAsync({
        payload: {
          scheduleId,
          ticketIds: lockedTickets.map((t) => t.id),
          comboIds,
          voucherCode: voucherCode || null,
          promotionCode: promotionCode || null,
          accountId: customerAccountId,
          method,
          cinema_id: currentUser.cinema_id,
        },
        idempotencyKey: getIdempotencyKey(),
      });
      setLastSale(result);
      toast.success(t('boxOffice.saleSuccess'));
      resetSeatSelection();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
      await refetchSeats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleId, lockedTickets, comboIds, voucherCode, promotionCode, method, customerAccountId, currentUser, sellMutation, resetSeatSelection, refetchSeats, t]);

  const [submittedSearchCode, setSubmittedSearchCode] = useState('');
  const { data: searchResults } = useBookingSearchByCode(submittedSearchCode);
  const handleSearch = useCallback(() => {
    if (!searchCode) return;
    setSubmittedSearchCode(searchCode);
  }, [searchCode]);

  return (
    <AdminLayout breadcrumb={t('boxOffice.breadcrumb')}>
      <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        <Select
          label={t('boxOffice.movieLabel')}
          value={movieId}
          onChange={(e) => {
            setMovieId(e.target.value);
            setScheduleId('');
            resetSeatSelection();
          }}
          disabled={locked}
          placeholder={t('boxOffice.moviePlaceholder')}
          options={movieOptions}
        />
        <Select
          label={t('counterSale.scheduleLabel')}
          value={scheduleId}
          onChange={(e) => {
            setScheduleId(e.target.value);
            resetSeatSelection();
          }}
          disabled={locked || !movieId}
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
                const isSelected = selectedSeatCodes.includes(ticket.seat_code);
                const isAvailable = ticket.status === TICKET_STATUS.available || (isSelected && ticket.held_by_me);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    disabled={!isAvailable || locked}
                    onClick={() => toggleSeat(ticket.seat_code)}
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
          {!locked && (
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              loading={holdSeatsMutation.isPending}
              disabled={selectedSeatCodes.length === 0}
              onClick={handleLockSeats}
            >
              {t('boxOffice.lockSeats')}
            </Button>
          )}
          {locked && <Badge variant="success">{t('boxOffice.seatsLocked')}</Badge>}
        </div>
      )}

      {locked && (
        <>
          {combos.length > 0 && (
            <div className="mt-6 max-w-md">
              <h6 className="mb-3 font-semibold text-white">{t('boxOffice.comboTitle')}</h6>
              <div className="flex flex-col gap-2">
                {combos.map((combo) => (
                  <label
                    key={combo.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-strong px-3 py-2.5 text-sm text-txt/80"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={comboIds.includes(combo.id)}
                        onChange={() =>
                          setComboIds((current) =>
                            current.includes(combo.id)
                              ? current.filter((id) => id !== combo.id)
                              : [...current, combo.id],
                          )
                        }
                      />
                      {combo.name}
                    </span>
                    <span className="font-medium text-white">{combo.price.toLocaleString()}đ</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
            <Input
              label={t('boxOffice.voucherLabel')}
              value={voucherCode}
              disabled={Boolean(promotionCode)}
              onChange={(e) => setVoucherCode(e.target.value)}
            />
            <Input
              label={t('boxOffice.promotionLabel')}
              value={promotionCode}
              disabled={Boolean(voucherCode)}
              onChange={(e) => setPromotionCode(e.target.value)}
            />
          </div>

          <div className="mt-6 max-w-md">
            <Select
              label={t('boxOffice.methodLabel')}
              value={method}
              onChange={(e) => setMethod(e.target.value as BoxOfficePaymentMethod)}
              options={PAYMENT_METHODS.map((m) => ({ label: t(`boxOffice.methods.${m}`), value: m }))}
            />
          </div>

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
              {t('counterSale.total')}: {estimatedTotal.toLocaleString()}đ
            </p>
            <Button
              type="button"
              variant="danger"
              loading={sellMutation.isPending}
              disabled={lockedTickets.length === 0 || !customerAccountId}
              onClick={handleSubmit}
            >
              {t('boxOffice.pay')}
            </Button>
          </div>
        </>
      )}

      {lastSale && <TicketReceipt bookingId={lastSale.bookingId} onPrint={() => window.print()} />}

      <div className="mt-10 max-w-md">
        <h6 className="mb-3 font-semibold text-white">{t('boxOffice.search.title')}</h6>
        <div className="flex gap-2">
          <Input
            placeholder={t('boxOffice.search.placeholder')}
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={handleSearch}>
            {t('boxOffice.search.action')}
          </Button>
        </div>
        {searchResults && searchResults.data.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {searchResults.data.map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => setLastSale({ bookingId: booking.id, code: booking.code, totalPrice: booking.total_price, alreadyProcessed: true })}
                className="flex items-center justify-between rounded-lg border border-border-strong px-3 py-2.5 text-left text-sm text-txt/80 hover:border-accent/60"
              >
                <span>{booking.code}</span>
                <Badge variant={booking.status === 'PAID' ? 'success' : 'default'}>{booking.status}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default BoxOffice;
