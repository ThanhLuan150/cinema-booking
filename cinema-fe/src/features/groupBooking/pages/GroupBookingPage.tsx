import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Alert } from '@/components/ui/Alert';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { ROUTES } from '@/constants/routes';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { useScheduleId } from '@/features/booking/hooks/useScheduleId';
import { useScheduleDetail } from '@/features/booking/hooks/useScheduleDetail';
import { useRoomsList } from '@/features/booking/hooks/useRoomsList';
import { useCombos } from '@/features/booking/hooks/useCombos';
import { MomoPaymentModal } from '@/features/booking/components/MomoPaymentModal';
import { GroupSeatPicker } from '../components/GroupSeatPicker';
import { GroupComboPicker } from '../components/GroupComboPicker';
import { GroupOrganizerForm } from '../components/GroupOrganizerForm';
import { GroupOrderSummary } from '../components/GroupOrderSummary';
import { groupBookingQueryKey, useCreateGroupBooking, useGroupBookingQuote } from '../hooks/useGroupBooking';
import {
  buildGroupPayload,
  emptyOrganizer,
  orderSignature,
  organizerErrors,
  setComboQuantity,
  toggleTicket,
} from '../utils/groupOrder';
import type { GroupComboLine, GroupOrganizer } from '../types/groupBooking.types';

const QUOTE_DEBOUNCE_MS = 350;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const errorCode = (error: unknown) => (error as { response?: { data?: { code?: string } } })?.response?.data?.code;

/**
 * /GroupBooking?movieId=&day=&time= — one booking for a whole group: many seats on one showtime,
 * combos by quantity, who it is for (a private group or a company), one MoMo payment. Every amount
 * shown comes from the server's quote; the seats are only claimed — all of them or none — at checkout.
 */
function GroupBookingPage() {
  const { t } = useTranslation('groupBooking');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isLoggedIn = useIsAuthenticated();

  const movieId = searchParams.get('movieId') ?? '';
  const movieDate = searchParams.get('day') ?? '';
  const timeBegin = searchParams.get('time') ?? '';

  const { data: resolvedSchedule } = useScheduleId(
    movieId && movieDate && timeBegin ? { movie_id: movieId, movie_date: movieDate, time_begin: timeBegin } : null,
  );
  const scheduleId = resolvedSchedule?.id ?? null;
  const { data: scheduleDetail } = useScheduleDetail(scheduleId);
  const { data: rooms = [] } = useRoomsList(Boolean(scheduleDetail?.room_id));
  const roomId = scheduleDetail?.room_id ?? null;
  const branchId = rooms.find((room) => room.id === roomId)?.cinema_id ?? null;
  const { data: movie } = useMovieDetail(movieId);
  const { data: combos = [] } = useCombos(branchId);
  const branchCombos = useMemo(
    () => combos.filter((combo) => combo.active && (branchId === null || combo.cinema_id === branchId)),
    [combos, branchId],
  );

  const [ticketIds, setTicketIds] = useState<number[]>([]);
  const [comboLines, setComboLines] = useState<GroupComboLine[]>([]);
  const [organizer, setOrganizer] = useState<GroupOrganizer>(emptyOrganizer);
  const [promotionCode, setPromotionCode] = useState('');
  const [pendingPayment, setPendingPayment] = useState<{ code: string; payUrl: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) navigate(`${ROUTES.login}?next=${encodeURIComponent(`${ROUTES.groupBooking}?${searchParams.toString()}`)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const payload = useMemo(
    () =>
      scheduleId && ticketIds.length > 0
        ? buildGroupPayload({ scheduleId, ticketIds, comboLines, organizer, promotionCode })
        : null,
    [scheduleId, ticketIds, comboLines, organizer, promotionCode],
  );
  // Who the group is for never changes the price, so typing in the organizer form does not re-quote.
  const quotePayload = useMemo(() => (payload ? { ...payload, organizer: emptyOrganizer() } : null), [payload]);
  const quoteQuery = useGroupBookingQuote(useDebounced(quotePayload, QUOTE_DEBOUNCE_MS));
  const quote = payload ? quoteQuery.data : undefined;
  const quoteError = payload && quoteQuery.error ? getApiErrorMessage(quoteQuery.error, t) : '';

  const fieldErrors = organizerErrors(organizer);
  const createMutation = useCreateGroupBooking();
  const canPay =
    Boolean(payload && quote && !quoteError && !quoteQuery.isFetching) &&
    quote!.unavailable_seat_codes.length === 0 &&
    quote!.stock_shortages.length === 0;

  // One key per distinct order: a retry or double-click of the same order gets the same booking back.
  const idempotencyRef = useRef<{ key: string; forOrder: string } | null>(null);
  const idempotencyKeyFor = (signature: string) => {
    if (idempotencyRef.current?.forOrder !== signature) {
      idempotencyRef.current = { key: crypto.randomUUID(), forOrder: signature };
    }
    return idempotencyRef.current.key;
  };

  const handlePay = async () => {
    setSubmitted(true);
    if (!payload) return;
    if (Object.keys(fieldErrors).length > 0) {
      toast.error(t('organizer.errors.fixFields'));
      return;
    }
    try {
      const result = await createMutation.mutateAsync({ payload, idempotencyKey: idempotencyKeyFor(orderSignature(payload)) });
      if (result.pay_url && result.booking.status === 'PENDING') setPendingPayment({ code: result.booking.code, payUrl: result.pay_url });
      else navigate(ROUTES.groupBookingDetail(result.booking.code));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
      if (errorCode(error) === 'SEAT_UNAVAILABLE') {
        queryClient.invalidateQueries({ queryKey: ['bookedSeats', scheduleId] });
        queryClient.invalidateQueries({ queryKey: groupBookingQueryKey });
      }
    }
  };

  const missingShowtime = !movieId || !movieDate || !timeBegin;

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 pb-16 pt-24 text-white md:px-10">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">{t('pageTitle')}</p>
          <h1 className="mt-1 text-2xl font-bold uppercase">{movie?.name ?? ' '}</h1>
          {!missingShowtime && (
            <p className="mt-1 text-sm text-txt/60">{t('showtime', { date: movieDate, time: timeBegin })}</p>
          )}
          <p className="mt-2 max-w-3xl text-sm text-txt/70">{t('intro')}</p>
          {!missingShowtime && (
            <Link
              to={`${ROUTES.bookSeat}?${searchParams.toString()}`}
              className="mt-2 inline-block text-sm text-accent no-underline hover:underline"
            >
              {t('backToRegular')}
            </Link>
          )}
        </header>

        {missingShowtime ? (
          <Alert variant="warning">{t('missingShowtime')}</Alert>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <GroupSeatPicker
                scheduleId={scheduleId}
                roomId={roomId}
                selectedTicketIds={ticketIds}
                maxSeats={quote?.limits.max_seats ?? null}
                onToggle={(id) => setTicketIds((current) => toggleTicket(current, id))}
              />
              <GroupComboPicker
                combos={branchCombos}
                lines={comboLines}
                onChange={(comboId, quantity) => setComboLines((current) => setComboQuantity(current, comboId, quantity))}
              />
              <GroupOrganizerForm organizer={organizer} errors={fieldErrors} showErrors={submitted} onChange={setOrganizer} />
            </div>
            <GroupOrderSummary
              quote={quote}
              quoting={quoteQuery.isFetching}
              quoteError={quoteError}
              selectedCount={ticketIds.length}
              promotionCode={promotionCode}
              onPromotionCodeChange={setPromotionCode}
              onPay={handlePay}
              paying={createMutation.isPending}
              canPay={canPay}
            />
          </div>
        )}
      </main>
      <Footer />

      {pendingPayment && (
        // Closing the payment dialog leaves a PENDING booking holding the seats: its page is where the
        // customer can pay later or let the seats go.
        <MomoPaymentModal
          payUrl={pendingPayment.payUrl}
          onClose={() => navigate(ROUTES.groupBookingDetail(pendingPayment.code))}
        />
      )}
    </div>
  );
}

export default GroupBookingPage;
