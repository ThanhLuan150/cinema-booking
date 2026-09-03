import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { cn } from '@/lib/cn';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';
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
  type KioskQuote,
  type KioskSeat,
  type KioskTicketView,
} from '../api/kiosk.api';
import { getStoredKioskKey, setStoredKioskKey } from '../api/kioskClient';

type Step = 'KEY' | 'MOVIE' | 'SHOWTIME' | 'SEAT' | 'COMBO' | 'PROMO' | 'PAYMENT' | 'TICKET';

function KioskApp() {
  const { t } = useTranslation('kiosk');
  const [hasKey, setHasKey] = useState(() => Boolean(getStoredKioskKey()));
  const [keyInput, setKeyInput] = useState('');
  const [step, setStep] = useState<Step>(hasKey ? 'MOVIE' : 'KEY');

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
          <section className="mx-auto max-w-md">
            <h2 className="mb-2 text-lg font-semibold text-white">{t('key.title')}</h2>
            <p className="mb-4 text-sm text-txt/60">{t('key.hint')}</p>
            <Input
              id="kiosk-key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="KIOSK-..."
            />
            <Button type="button" variant="danger" className="mt-4" loading={busy} disabled={!keyInput.trim()} onClick={saveKey}>
              {t('key.activate')}
            </Button>
          </section>
        )}

        {step === 'MOVIE' && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.movie')}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {(moviesQuery.data ?? []).map((movie) => (
                <button
                  key={movie.id}
                  type="button"
                  onClick={() => {
                    setMovieId(movie.id);
                    setStep('SHOWTIME');
                  }}
                  className="rounded-xl border border-border bg-surface p-4 text-left hover:border-accent/60"
                >
                  <p className="font-semibold text-white">{movie.name}</p>
                </button>
              ))}
              {moviesQuery.isSuccess && (moviesQuery.data ?? []).length === 0 && (
                <p className="text-sm text-txt/60">{t('empty.movies')}</p>
              )}
            </div>
          </section>
        )}

        {step === 'SHOWTIME' && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.showtime')}</h2>
            <div className="flex flex-wrap gap-3">
              {(showtimesQuery.data ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setScheduleId(s.id);
                    setSelectedSeatCodes([]);
                    setLocked(false);
                    setStep('SEAT');
                  }}
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-white hover:border-accent/60"
                >
                  {s.movie_date} · {s.time_begin}
                </button>
              ))}
              {showtimesQuery.isSuccess && (showtimesQuery.data ?? []).length === 0 && (
                <p className="text-sm text-txt/60">{t('empty.showtimes')}</p>
              )}
            </div>
            <Button type="button" variant="outline" className="mt-6" onClick={() => setStep('MOVIE')}>
              {t('back')}
            </Button>
          </section>
        )}

        {step === 'SEAT' && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.seat')}</h2>
            <div className="flex flex-wrap gap-2">
              {seats.map((seat) => {
                const isSelected = selectedSeatCodes.includes(seat.seat_code);
                const isBooked = seat.status === TICKET_STATUS.sold;
                const takenByOther = seat.status !== TICKET_STATUS.available && !seat.held_by_me;
                return (
                  <button
                    key={seat.id}
                    type="button"
                    disabled={takenByOther || locked}
                    onClick={() => toggleSeat(seat)}
                    className={cn(
                      'h-10 min-w-[2.75rem] rounded px-2 text-xs font-medium text-white transition-opacity',
                      SEAT_TYPE_CLASS[seat.seat_type] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard],
                      (takenByOther || isBooked) && 'cursor-not-allowed opacity-30',
                      isSelected && 'ring-2 ring-accent',
                    )}
                  >
                    {seat.seat_code}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-sm text-txt/70">{t('seat.selected', { count: selectedSeatCodes.length, total: seatTotal.toLocaleString() })}</p>
            <div className="mt-4 flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep('SHOWTIME')}>
                {t('back')}
              </Button>
              <Button type="button" variant="danger" loading={busy} disabled={selectedSeatCodes.length === 0} onClick={confirmSeats}>
                {t('seat.confirm')}
              </Button>
            </div>
          </section>
        )}

        {step === 'COMBO' && (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.combo')}</h2>
            <div className="flex flex-col gap-2">
              {combos.map((combo) => (
                <label
                  key={combo.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-strong px-4 py-3 text-sm text-txt/80"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={comboIds.includes(combo.id)}
                      onChange={() =>
                        setComboIds((cur) =>
                          cur.includes(combo.id) ? cur.filter((id) => id !== combo.id) : [...cur, combo.id],
                        )
                      }
                    />
                    {combo.name}
                  </span>
                  <span className="font-medium text-white">{combo.price.toLocaleString()}đ</span>
                </label>
              ))}
              {combos.length === 0 && <p className="text-sm text-txt/60">{t('empty.combos')}</p>}
            </div>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep('PROMO')}>
                {t('skip')}
              </Button>
              <Button type="button" variant="danger" onClick={() => setStep('PROMO')}>
                {t('next')}
              </Button>
            </div>
          </section>
        )}

        {step === 'PROMO' && (
          <section className="max-w-md">
            <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.promo')}</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('promo.voucher')}
                value={voucherCode}
                disabled={Boolean(promotionCode)}
                onChange={(e) => setVoucherCode(e.target.value)}
              />
              <Input
                label={t('promo.promotion')}
                value={promotionCode}
                disabled={Boolean(voucherCode)}
                onChange={(e) => setPromotionCode(e.target.value)}
              />
            </div>
            <p className="mt-3 text-xs text-txt/50">{t('promo.hint')}</p>
            <div className="mt-6 flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep('COMBO')}>
                {t('back')}
              </Button>
              <Button type="button" variant="danger" loading={busy} onClick={goToPayment}>
                {t('promo.review')}
              </Button>
            </div>
          </section>
        )}

        {step === 'PAYMENT' && (
          <section className="max-w-md">
            <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.payment')}</h2>
            <div className="rounded-xl border border-border bg-surface p-5 text-sm">
              <Row label={t('payment.seats')} value={`${(quote?.seatTotal ?? seatTotal).toLocaleString()}đ`} />
              <Row label={t('payment.combos')} value={`${(quote?.comboTotal ?? comboTotal).toLocaleString()}đ`} />
              {(quote?.discountAmount ?? 0) > 0 && (
                <Row label={t('payment.discount')} value={`-${(quote?.discountAmount ?? 0).toLocaleString()}đ`} />
              )}
              <div className="mt-3 border-t border-border pt-3">
                <Row
                  label={t('payment.total')}
                  value={`${(quote?.totalPrice ?? seatTotal + comboTotal).toLocaleString()}đ`}
                  strong
                />
              </div>
            </div>

            {!paying ? (
              <div className="mt-6 flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep('PROMO')}>
                  {t('back')}
                </Button>
                <Button type="button" variant="danger" loading={busy} onClick={startPayment}>
                  {t('payment.pay')}
                </Button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-border p-5">
                <p className="mb-3 text-sm text-txt/70">{t('payment.terminalPrompt')}</p>
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="danger" loading={busy} onClick={() => finishPayment('SUCCESS', 'CARD')}>
                    {t('payment.simCardOk')}
                  </Button>
                  <Button type="button" variant="secondary" loading={busy} onClick={() => finishPayment('SUCCESS', 'QR_PAYMENT')}>
                    {t('payment.simQrOk')}
                  </Button>
                  <Button type="button" variant="outline" loading={busy} onClick={() => finishPayment('FAILURE', 'CARD')}>
                    {t('payment.simFail')}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {step === 'TICKET' && (
          <section>
            <h2 className="mb-2 text-lg font-semibold text-white">{t('ticket.title')}</h2>
            <p className="mb-6 text-sm text-txt/60">{t('ticket.hint')}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {tickets.map((ticket) => (
                <div key={ticket.ticket_id} className="flex items-center gap-4 rounded-xl border border-border-strong p-4">
                  {ticket.qr_token && <QRCodeSVG value={ticket.qr_token} size={96} />}
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-semibold text-white">{ticket.movie?.name}</p>
                    <p className="text-txt/70">
                      {ticket.schedule?.movie_date} {ticket.schedule?.time_begin}
                    </p>
                    <p className="text-txt/70">{t('ticket.seat', { code: ticket.seat_code })}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex gap-3 print:hidden">
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                {t('ticket.print')}
              </Button>
              <Button type="button" variant="danger" onClick={() => resetOrder(false)}>
                {t('ticket.done')}
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={cn('text-txt/70', strong && 'font-semibold text-white')}>{label}</span>
      <span className={cn('text-white', strong && 'text-lg font-bold text-accent')}>{value}</span>
    </div>
  );
}

export default KioskApp;
