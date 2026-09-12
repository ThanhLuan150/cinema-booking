import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { useCombos } from '@/features/booking/hooks/useCombos';
import { useHoldSeats } from '@/features/booking/hooks/useHoldSeats';
import { useReleaseSeats } from '@/features/booking/hooks/useReleaseSeats';
import type { Booking } from '@/features/booking/types/booking.types';
import { useBookingSearchByCode } from '../hooks/useBookingSearchByCode';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMySchedules } from '../hooks/useMySchedules';
import { useScheduleSeats } from '../hooks/useScheduleSeats';
import { useBoxOfficeSell } from '../hooks/useBoxOfficeSell';
import { findAccountByEmail } from '../api/employee.api';
import type { BoxOfficePaymentMethod, BoxOfficeSellResult } from '../types/boxOffice.types';
import { BoxOfficeMovieScheduleSelect } from '../components/BoxOfficeMovieScheduleSelect';
import { BoxOfficeSeatSelection } from '../components/BoxOfficeSeatSelection';
import { BoxOfficeComboSelection } from '../components/BoxOfficeComboSelection';
import { BoxOfficeCheckoutForm } from '../components/BoxOfficeCheckoutForm';
import { BoxOfficeTicketReceipt } from '../components/BoxOfficeTicketReceipt';
import { BoxOfficeBookingSearch } from '../components/BoxOfficeBookingSearch';

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

  const toggleCombo = useCallback((comboId: number) => {
    setComboIds((current) => (current.includes(comboId) ? current.filter((id) => id !== comboId) : [...current, comboId]));
  }, []);

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

  const selectSearchedBooking = useCallback((booking: Booking) => {
    setLastSale({ bookingId: booking.id, code: booking.code, totalPrice: booking.total_price, alreadyProcessed: true });
  }, []);

  return (
    <AdminLayout breadcrumb={t('boxOffice.breadcrumb')}>
      <BoxOfficeMovieScheduleSelect
        movieId={movieId}
        scheduleId={scheduleId}
        movieOptions={movieOptions}
        scheduleOptions={scheduleOptions}
        locked={locked}
        onMovieChange={(value) => {
          setMovieId(value);
          setScheduleId('');
          resetSeatSelection();
        }}
        onScheduleChange={(value) => {
          setScheduleId(value);
          resetSeatSelection();
        }}
      />

      {scheduleId && (
        <BoxOfficeSeatSelection
          tickets={tickets}
          selectedSeatCodes={selectedSeatCodes}
          locked={locked}
          lockPending={holdSeatsMutation.isPending}
          onToggleSeat={toggleSeat}
          onLockSeats={handleLockSeats}
        />
      )}

      {locked && (
        <>
          <BoxOfficeComboSelection combos={combos} comboIds={comboIds} onToggleCombo={toggleCombo} />

          <BoxOfficeCheckoutForm
            voucherCode={voucherCode}
            promotionCode={promotionCode}
            method={method}
            email={email}
            customerAccountId={customerAccountId}
            lookingUp={lookingUp}
            estimatedTotal={estimatedTotal}
            sellPending={sellMutation.isPending}
            submitDisabled={lockedTickets.length === 0 || !customerAccountId}
            onVoucherCodeChange={setVoucherCode}
            onPromotionCodeChange={setPromotionCode}
            onMethodChange={setMethod}
            onEmailChange={(value) => {
              setEmail(value);
              setCustomerAccountId(null);
            }}
            onFindCustomer={handleFindCustomer}
            onSubmit={handleSubmit}
          />
        </>
      )}

      {lastSale && <BoxOfficeTicketReceipt bookingId={lastSale.bookingId} onPrint={() => window.print()} />}

      <BoxOfficeBookingSearch
        searchCode={searchCode}
        searchResults={searchResults?.data ?? []}
        onSearchCodeChange={setSearchCode}
        onSearch={handleSearch}
        onSelectBooking={selectSearchedBooking}
      />
    </AdminLayout>
  );
}

export default BoxOffice;
