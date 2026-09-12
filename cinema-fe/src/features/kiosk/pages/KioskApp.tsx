import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { TICKET_STATUS } from '@/constants/ticketStatus';
import {
  checkoutKioskOrder,
  confirmKioskPayment,
  getKioskBookingTickets,
  getKioskCombos,
  getKioskMovies,
  getKioskSeats,
  getKioskSession,
  getKioskShowtimes,
  holdKioskSeats,
  quoteKioskOrder,
  releaseKioskSeats,
} from '../api/kiosk.api';
import { getStoredKioskKey, setStoredKioskKey } from '../api/kioskClient';
import type { KioskMovie, KioskQuote, KioskSeat, KioskShowtime, KioskStep, KioskTicketView } from '../types/kiosk.types';
import { KeyStep } from '../components/KeyStep';
import { MovieStep } from '../components/MovieStep';
import { ShowtimeStep } from '../components/ShowtimeStep';
import { SeatStep } from '../components/SeatStep';
import { ComboStep } from '../components/ComboStep';
import { PromoStep } from '../components/PromoStep';
import { PaymentStep } from '../components/PaymentStep';
import { TicketStep } from '../components/TicketStep';

function KioskApp() {
  const { t } = useTranslation('kiosk');
  const [hasKey, setHasKey] = useState(() => Boolean(getStoredKioskKey()));
  const [keyInput, setKeyInput] = useState('');
  const [step, setStep] = useState<KioskStep>(hasKey ? 'MOVIE' : 'KEY');

  const [movieId, setMovieId] = useState<number | null>(null);
  const [scheduleId, setScheduleId] = useState<number | null>(null);
  const [selectedSeatCodes, setSelectedSeatCodes] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const [comboIds, setComboIds] = useState<number[]>([]);
  const [voucherCode, setVoucherCode] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [quote, setQuote] = useState<KioskQuote | null>(null);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tickets, setTickets] = useState<KioskTicketView[]>([]);

  const sessionQuery = useQuery({
    queryKey: ['kioskSession'],
    queryFn: getKioskSession,
    enabled: hasKey,
    retry: false,
  });

  // A rejected session (bad / revoked key) drops back to the key screen.
  useEffect(() => {
    if (sessionQuery.isError && hasKey) {
      setStoredKioskKey(null);
      setHasKey(false);
      setStep('KEY');
    }
  }, [sessionQuery.isError, hasKey]);

  const moviesQuery = useQuery({ queryKey: ['kioskMovies'], queryFn: getKioskMovies, enabled: hasKey && sessionQuery.isSuccess });
  const showtimesQuery = useQuery({
    queryKey: ['kioskShowtimes', movieId],
    queryFn: () => getKioskShowtimes(movieId as number),
    enabled: movieId != null,
  });
  const seatsQuery = useQuery({
    queryKey: ['kioskSeats', scheduleId],
    queryFn: () => getKioskSeats(scheduleId as number),
    enabled: scheduleId != null,
    refetchInterval: step === 'SEAT' && !locked ? 5000 : false,
  });
  const combosQuery = useQuery({ queryKey: ['kioskCombos'], queryFn: getKioskCombos, enabled: hasKey && sessionQuery.isSuccess });

  const seats = useMemo(() => seatsQuery.data ?? [], [seatsQuery.data]);
  const combos = useMemo(() => combosQuery.data ?? [], [combosQuery.data]);
  const selectedTickets = useMemo(
    () => seats.filter((s) => selectedSeatCodes.includes(s.seat_code)),
    [seats, selectedSeatCodes],
  );
  const ticketIds = useMemo(() => selectedTickets.map((s) => s.id), [selectedTickets]);

  const seatTotal = useMemo(() => selectedTickets.reduce((sum, s) => sum + (s.price ?? 0), 0), [selectedTickets]);
  const comboTotal = useMemo(
    () => combos.filter((c) => comboIds.includes(c.id)).reduce((sum, c) => sum + c.price, 0),
    [combos, comboIds],
  );

  // Release whatever this kiosk is holding when the customer walks away mid-flow.
  const heldRef = useRef<{ scheduleId: number | null; seatCodes: string[]; locked: boolean }>({
    scheduleId: null,
    seatCodes: [],
    locked: false,
  });
  useEffect(() => {
    heldRef.current = { scheduleId, seatCodes: selectedSeatCodes, locked };
  }, [scheduleId, selectedSeatCodes, locked]);

  const resetOrder = useCallback(
    (releaseHeld = true) => {
      const { scheduleId: sid, seatCodes, locked: isLocked } = heldRef.current;
      if (releaseHeld && isLocked && sid && seatCodes.length > 0) {
        releaseKioskSeats(sid, seatCodes).catch(() => {});
      }
      setMovieId(null);
      setScheduleId(null);
      setSelectedSeatCodes([]);
      setLocked(false);
      setComboIds([]);
      setVoucherCode('');
      setPromotionCode('');
      setQuote(null);
      setOrderCode(null);
      setPaying(false);
      setTickets([]);
      setStep('MOVIE');
    },
    [],
  );

  useEffect(() => () => resetOrder(), [resetOrder]);

  const saveKey = useCallback(async () => {
    const key = keyInput.trim();
    if (!key) return;
    setBusy(true);
    setStoredKioskKey(key);
    try {
      await getKioskSession();
      setHasKey(true);
      setKeyInput('');
      setStep('MOVIE');
      sessionQuery.refetch();
    } catch (error) {
      setStoredKioskKey(null);
      toast.error(getApiErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }, [keyInput, sessionQuery, t]);

  const toggleSeat = useCallback(
    (seat: KioskSeat) => {
      if (locked) return;
      const takenByOther = seat.status !== TICKET_STATUS.available && !seat.held_by_me;
      if (takenByOther) return;
      setSelectedSeatCodes((cur) =>
        cur.includes(seat.seat_code) ? cur.filter((c) => c !== seat.seat_code) : [...cur, seat.seat_code],
      );
    },
    [locked],
  );

  const confirmSeats = useCallback(async () => {
    if (!scheduleId || selectedSeatCodes.length === 0) return;
    setBusy(true);
    try {
      await holdKioskSeats(scheduleId, selectedSeatCodes);
      setLocked(true);
      await seatsQuery.refetch();
      setStep('COMBO');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
      await seatsQuery.refetch();
    } finally {
      setBusy(false);
    }
  }, [scheduleId, selectedSeatCodes, seatsQuery, t]);

  const orderInput = useMemo(
    () => ({
      scheduleId: scheduleId as number,
      ticketIds,
      comboIds,
      voucherCode: voucherCode.trim() || null,
      promotionCode: promotionCode.trim() || null,
    }),
    [scheduleId, ticketIds, comboIds, voucherCode, promotionCode],
  );

  const goToPayment = useCallback(async () => {
    setBusy(true);
    try {
      const q = await quoteKioskOrder(orderInput);
      setQuote(q);
      setStep('PAYMENT');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  }, [orderInput, t]);

  // One idempotency key per distinct order — a double-tap on "Pay" reuses it.
  const idemRef = useRef<{ key: string; sig: string } | null>(null);
  const idempotencyKey = () => {
    const sig = JSON.stringify(orderInput);
    if (idemRef.current?.sig !== sig) idemRef.current = { key: crypto.randomUUID(), sig };
    return idemRef.current.key;
  };

  const startPayment = useCallback(async () => {
    setBusy(true);
    try {
      const result = await checkoutKioskOrder(orderInput, idempotencyKey());
      setOrderCode(result.code);
      setPaying(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
      await seatsQuery.refetch();
    } finally {
      setBusy(false);
    }
    // idempotencyKey is a stable ref-backed helper, intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderInput, seatsQuery, t]);

  const finishPayment = useCallback(
    async (outcome: 'SUCCESS' | 'FAILURE', method: 'CARD' | 'QR_PAYMENT') => {
      if (!orderCode) return;
      setBusy(true);
      try {
        const result = await confirmKioskPayment(orderCode, outcome, method);
        if (result.paid) {
          const data = await getKioskBookingTickets(orderCode);
          setTickets(data.tickets);
          setStep('TICKET');
        } else {
          toast.error(t('errors.paymentFailed'));
          // Seats were released server-side; reset back to seat selection.
          setPaying(false);
          setOrderCode(null);
          setLocked(false);
          setSelectedSeatCodes([]);
          setQuote(null);
          setStep('SEAT');
          await seatsQuery.refetch();
        }
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      } finally {
        setBusy(false);
      }
    },
    [orderCode, seatsQuery, t],
  );

  const branchName = sessionQuery.data?.branch?.name ?? '';

  const selectMovie = useCallback((movie: KioskMovie) => {
    setMovieId(movie.id);
    setStep('SHOWTIME');
  }, []);

  const selectShowtime = useCallback((showtime: KioskShowtime) => {
    setScheduleId(showtime.id);
    setSelectedSeatCodes([]);
    setLocked(false);
    setStep('SEAT');
  }, []);

  const toggleCombo = useCallback((comboId: number) => {
    setComboIds((cur) => (cur.includes(comboId) ? cur.filter((id) => id !== comboId) : [...cur, comboId]));
  }, []);

  return (
    <div className="min-h-screen bg-bg text-txt">
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          {branchName && <p className="text-sm text-txt/60">{t('branchLine', { branch: branchName })}</p>}
        </div>
        {hasKey && step !== 'KEY' && step !== 'TICKET' && (
          <Button type="button" variant="outline" onClick={() => resetOrder()}>
            {t('startOver')}
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-8 py-10">
        {step === 'KEY' && (
          <KeyStep keyInput={keyInput} onKeyInputChange={setKeyInput} busy={busy} onActivate={saveKey} />
        )}

        {step === 'MOVIE' && (
          <MovieStep movies={moviesQuery.data ?? []} isSuccess={moviesQuery.isSuccess} onSelect={selectMovie} />
        )}

        {step === 'SHOWTIME' && (
          <ShowtimeStep
            showtimes={showtimesQuery.data ?? []}
            isSuccess={showtimesQuery.isSuccess}
            onSelect={selectShowtime}
            onBack={() => setStep('MOVIE')}
          />
        )}

        {step === 'SEAT' && (
          <SeatStep
            seats={seats}
            selectedSeatCodes={selectedSeatCodes}
            locked={locked}
            seatTotal={seatTotal}
            busy={busy}
            onToggleSeat={toggleSeat}
            onBack={() => setStep('SHOWTIME')}
            onConfirm={confirmSeats}
          />
        )}

        {step === 'COMBO' && (
          <ComboStep
            combos={combos}
            comboIds={comboIds}
            onToggleCombo={toggleCombo}
            onSkip={() => setStep('PROMO')}
            onNext={() => setStep('PROMO')}
          />
        )}

        {step === 'PROMO' && (
          <PromoStep
            voucherCode={voucherCode}
            promotionCode={promotionCode}
            busy={busy}
            onVoucherCodeChange={setVoucherCode}
            onPromotionCodeChange={setPromotionCode}
            onBack={() => setStep('COMBO')}
            onReview={goToPayment}
          />
        )}

        {step === 'PAYMENT' && (
          <PaymentStep
            quote={quote}
            seatTotal={seatTotal}
            comboTotal={comboTotal}
            paying={paying}
            busy={busy}
            onBack={() => setStep('PROMO')}
            onPay={startPayment}
            onFinish={finishPayment}
          />
        )}

        {step === 'TICKET' && (
          <TicketStep tickets={tickets} onPrint={() => window.print()} onDone={() => resetOrder(false)} />
        )}
      </main>
    </div>
  );
}

export default KioskApp;
