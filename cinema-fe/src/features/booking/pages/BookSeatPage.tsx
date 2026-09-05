import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/cn';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { getMoviePosterUrl } from '@/utils';
import { BookingSteps } from '../components/BookingSteps';
import { SeatHoldCountdown } from '../components/SeatHoldCountdown';
import { useScheduleId } from '../hooks/useScheduleId';
import { useBookedSeats } from '../hooks/useBookedSeats';
import { useRoomSeats } from '../hooks/useRoomSeats';
import { useHoldSeats } from '../hooks/useHoldSeats';
import { useReleaseSeats } from '../hooks/useReleaseSeats';
import { useScheduleDetail } from '../hooks/useScheduleDetail';
import { useRoomsList } from '../hooks/useRoomsList';
import { useCombos } from '../hooks/useCombos';
import { useValidateVoucher } from '../hooks/useValidateVoucher';
import { useValidatePromotion } from '../hooks/useValidatePromotion';
import { useMomoPayment } from '../hooks/useMomoPayment';
import { useValidateGiftCard } from '@/features/giftCards/hooks/useValidateGiftCard';
import { usePayWithGiftCard } from '@/features/giftCards/hooks/usePayWithGiftCard';
import type { GiftCardValidationResult } from '@/features/giftCards/types/giftCard.types';
import {
  applyPromotionFailure,
  applyPromotionSuccess,
  applyVoucherFailure,
  applyVoucherSuccess,
  clearExpiredSelection,
  clearPromotion,
  clearVoucher,
  resetBookingSelection,
  setbranchId,
  setMomoPayUrl,
  setPromotionCode,
  setScheduleId,
  setSeatHoldExpiry,
  setShowtime,
  setVoucherCode,
  toggleCombo,
  toggleSeat,
} from '../store/bookingSlice';
import type { BookedSeatTicket } from '../types/booking.types';
import { SEAT_TYPE_CLASS, SEAT_TYPE_KEY, SEAT_TYPES } from '@/constants/seatType';
import { TICKET_STATUS } from '@/constants/ticketStatus';
import { ROUTES } from '@/constants/routes';
import { Seat } from 'types/entities';

type SeatCellStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'DISABLED';

interface SeatCell {
  seatCode: string;
  seatType: number;
  status: SeatCellStatus;
  // null only for a DISABLED seat, which has no ticket to select
  ticket: BookedSeatTicket | null;
}


function buildSeatCells(tickets: BookedSeatTicket[], roomSeats: Seat[]): SeatCell[] {
  const ticketBySeatCode = new Map(tickets.map((ticket) => [ticket.seat_code, ticket]));
  // Room seat map hasn't loaded yet (or the room has none on record) — fall back to laying out
  // purely from tickets so the grid still renders once schedule data arrives.
  const seatSlots =
    roomSeats.length > 0
      ? roomSeats.map((seat) => ({ seat_code: seat.seat_code, seat_type: seat.seat_type, isDisabled: seat.status === 'DISABLED' }))
      : tickets.map((ticket) => ({ seat_code: ticket.seat_code, seat_type: ticket.seat_type, isDisabled: false }));

  const cells: SeatCell[] = [];
  for (const seat of seatSlots) {
    if (seat.isDisabled) {
      cells.push({ seatCode: seat.seat_code, seatType: seat.seat_type, status: 'DISABLED', ticket: null });
      continue;
    }
    const ticket = ticketBySeatCode.get(seat.seat_code);
    if (!ticket) continue;
    const status: SeatCellStatus =
      ticket.status === TICKET_STATUS.sold ? 'BOOKED' : ticket.status === TICKET_STATUS.held ? 'HELD' : 'AVAILABLE';
    cells.push({ seatCode: seat.seat_code, seatType: ticket.seat_type, status, ticket });
  }
  return cells;
}

function seatCellClass(cell: SeatCell, isSelected: boolean) {
  if (cell.status === 'DISABLED') return 'cursor-not-allowed bg-white/10 text-white/30 line-through';
  if (cell.status === 'BOOKED') return 'cursor-not-allowed bg-white/25';
  if (cell.status === 'HELD' && !cell.ticket?.held_by_me) return 'cursor-not-allowed bg-white/40';
  return cn(
    'cursor-pointer hover:scale-110',
    SEAT_TYPE_CLASS[cell.seatType] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard],
    isSelected && 'scale-110 bg-emerald-500 text-white ring-2 ring-white',
  );
}

function seatCellTitle(cell: SeatCell, t: TFunction) {
  if (cell.status === 'DISABLED') return t('bookSeat.legend.disabled');
  if (cell.status === 'BOOKED') return t('bookSeat.legend.sold');
  if (cell.status === 'HELD') return t(cell.ticket?.held_by_me ? 'bookSeat.legend.selecting' : 'bookSeat.legend.held');
  return t(`bookSeat.legend.${SEAT_TYPE_KEY[cell.seatType] ?? 'standard'}`);
}

function SeatGrid({ scheduleId, roomId }: { scheduleId: number | null; roomId: number | null }) {
  const { t } = useTranslation('booking');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const selectedSeatCodes = useAppSelector((state) => state.booking.selectedSeatCodes);
  const { data: ticketList = [], isLoading } = useBookedSeats(scheduleId);
  const { data: roomSeats = [] } = useRoomSeats(roomId);
  const holdSeatsMutation = useHoldSeats(scheduleId);
  const releaseSeatsMutation = useReleaseSeats(scheduleId);
  const isMutating = holdSeatsMutation.isPending || releaseSeatsMutation.isPending;

  if (!scheduleId || isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (ticketList.length === 0) {
    return (
      <EmptyState
        title={t('bookSeat.noSeatMap.title')}
        description={t('bookSeat.noSeatMap.description')}
      />
    );
  }

  const cells = buildSeatCells(ticketList, roomSeats);
  const rows: Record<string, SeatCell[]> = {};
  for (const cell of cells) {
    const match = cell.seatCode.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) continue;
    const rowLetter = match[1];
    if (!rows[rowLetter]) rows[rowLetter] = [];
    rows[rowLetter].push(cell);
  }
  for (const rowLetter of Object.keys(rows)) {
    rows[rowLetter].sort(
      (a, b) =>
        Number(a.seatCode.slice(rowLetter.length)) - Number(b.seatCode.slice(rowLetter.length)),
    );
  }

  const handleSelect = (cell: SeatCell) => {
    if (!cell.ticket) return;
    const ticket = cell.ticket;
    const isSelected = selectedSeatCodes.includes(cell.seatCode);
    if (isSelected) {
      // Release optimistically — worst case the hold simply expires on its own TTL.
      dispatch(toggleSeat(ticket));
      releaseSeatsMutation.mutate([cell.seatCode]);
      return;
    }
    holdSeatsMutation.mutate([cell.seatCode], {
      onSuccess: (result) => {
        dispatch(toggleSeat(ticket));
        if (result?.held_until) {
          dispatch(setSeatHoldExpiry({ seatCode: cell.seatCode, heldUntil: result.held_until }));
        }
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, t));
        queryClient.invalidateQueries({ queryKey: ['bookedSeats', scheduleId] });
      },
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {Object.keys(rows)
        .sort()
        .map((rowLetter) => (
          <div className="flex gap-1" key={rowLetter}>
            {rows[rowLetter].map((cell) => {
              const isSelected = selectedSeatCodes.includes(cell.seatCode);
              const isSelectable =
                !isMutating && cell.ticket && (cell.status === 'AVAILABLE' || (cell.status === 'HELD' && cell.ticket.held_by_me));
              return (
                <button
                  type="button"
                  key={cell.seatCode}
                  title={seatCellTitle(cell, t)}
                  className={cn(
                    'flex h-8 w-9 items-center justify-center rounded-t-lg text-[10px] font-semibold text-black transition-transform',
                    seatCellClass(cell, isSelected),
                  )}
                  onClick={() => isSelectable && handleSelect(cell)}
                >
                  {cell.seatCode}
                </button>
              );
            })}
          </div>
        ))}
    </div>
  );
}

function BookSeatPage() {
  const { t } = useTranslation('booking');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isLoggedIn = useIsAuthenticated();

  // Paying with a Gift Card is its own checkout flow (it fully settles the booking on the
  // spot, ignoring any voucher/promotion code) — kept as local state rather than in
  // bookingSlice since it never survives a checkout attempt either way.
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardPreview, setGiftCardPreview] = useState<GiftCardValidationResult | null>(null);
  const [giftCardError, setGiftCardError] = useState('');

  const movieId = searchParams.get('movieId') ?? '';
  const movieDate = searchParams.get('day') ?? '';
  const timeBegin = searchParams.get('time') ?? '';

  const {
    scheduleId,
    selectedSeatCodes,
    selectedTickets,
    heldUntilBySeat,
    selectedComboIds,
    branchId,
    voucherCode,
    voucherResult,
    voucherError,
    promotionCode,
    promotionResult,
    promotionError,
    momoPayUrl,
  } = useAppSelector((state) => state.booking);

  const earliestHoldExpiry = useMemo(() => {
    const expiries = selectedSeatCodes.map((code) => heldUntilBySeat[code]).filter(Boolean);
    if (expiries.length === 0) return null;
    return expiries.reduce((earliest, current) => (current < earliest ? current : earliest));
  }, [selectedSeatCodes, heldUntilBySeat]);

  const handleHoldExpire = useCallback(() => {
    dispatch(clearExpiredSelection());
    queryClient.invalidateQueries({ queryKey: ['bookedSeats', scheduleId] });
    toast.error(t('bookSeat.holdExpired'));
  }, [dispatch, queryClient, scheduleId, t]);

  // Each visit to this page starts a fresh selection — nothing should carry over from a previous booking attempt.
  useEffect(() => {
    dispatch(resetBookingSelection());
    dispatch(setShowtime({ movieId, movieDate, timeBegin }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, movieDate, timeBegin]);

  useEffect(() => {
    if (!isLoggedIn) {
      toast.error(t('bookSeat.notLoggedIn'));
      window.location.href = ROUTES.login;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  const { data: resolvedSchedule } = useScheduleId(
    movieId && movieDate && timeBegin
      ? { movie_id: movieId, movie_date: movieDate, time_begin: timeBegin }
      : null,
  );
  useEffect(() => {
    if (resolvedSchedule?.id) dispatch(setScheduleId(resolvedSchedule.id));
  }, [resolvedSchedule, dispatch]);

  const { data: scheduleDetail } = useScheduleDetail(scheduleId);
  const { data: rooms = [] } = useRoomsList(!!scheduleDetail?.room_id);
  useEffect(() => {
    if (!scheduleDetail?.room_id || rooms.length === 0) return;
    const room = rooms.find((r) => r.id === scheduleDetail.room_id);
    if (room) dispatch(setbranchId(room.cinema_id));
  }, [scheduleDetail, rooms, dispatch]);

  const { data: movie } = useMovieDetail(movieId);

  const { data: combos = [] } = useCombos();
  const validateVoucherMutation = useValidateVoucher();
  const validatePromotionMutation = useValidatePromotion();
  const validateGiftCardMutation = useValidateGiftCard();
  const payWithGiftCardMutation = usePayWithGiftCard();
  const momoPaymentMutation = useMomoPayment();

  const seatTotal = useMemo(
    () => selectedTickets.reduce((sum, ticket) => sum + (ticket.price ?? 0), 0),
    [selectedTickets],
  );

  const comboTotal = combos
    .filter((c) => selectedComboIds.includes(c.id))
    .reduce((sum, c) => sum + c.price, 0);
  // A customer applies a voucher OR a promotion to an order, never both.
  const discount = voucherResult?.discount_amount ?? promotionResult?.discount_amount ?? 0;
  const totalPrice = Math.max(seatTotal + comboTotal - discount, 0);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    try {
      const result = await validateVoucherMutation.mutateAsync({
        code: voucherCode.trim(),
        cinema_id: branchId,
        order_value: seatTotal + comboTotal,
      });
      dispatch(applyVoucherSuccess(result));
    } catch (error) {
      dispatch(applyVoucherFailure(getApiErrorMessage(error, t) || t('voucher.applyFailed')));
    }
  };

  const handleApplyPromotion = async () => {
    if (!promotionCode.trim()) return;
    try {
      const result = await validatePromotionMutation.mutateAsync({
        code: promotionCode.trim(),
        branch_id: branchId,
        movie_id: movieId ? Number(movieId) : null,
        showtime_id: scheduleId,
        combo_ids: selectedComboIds,
        order_value: seatTotal + comboTotal,
      });
      dispatch(applyPromotionSuccess(result));
    } catch (error) {
      dispatch(applyPromotionFailure(getApiErrorMessage(error, t) || t('promotion.applyFailed')));
    }
  };

  const idempotencyKeyRef = useRef<{ key: string; forOrder: string } | null>(null);
  const getIdempotencyKey = (orderSignature: string) => {
    if (idempotencyKeyRef.current?.forOrder !== orderSignature) {
      idempotencyKeyRef.current = { key: crypto.randomUUID(), forOrder: orderSignature };
    }
    return idempotencyKeyRef.current.key;
  };

  const handleApplyGiftCard = async () => {
    if (!giftCardCode.trim()) return;
    setGiftCardError('');
    try {
      const result = await validateGiftCardMutation.mutateAsync({
        code: giftCardCode.trim(),
        orderValue: seatTotal + comboTotal,
      });
      setGiftCardPreview(result);
    } catch (error) {
      setGiftCardPreview(null);
      setGiftCardError(getApiErrorMessage(error, t) || t('giftCard.applyFailed'));
    }
  };

  const handleClearGiftCard = () => {
    setGiftCardPreview(null);
    setGiftCardError('');
    setGiftCardCode('');
  };

  const handlePayWithGiftCard = async () => {
    if (selectedSeatCodes.length === 0 || selectedTickets.length === 0) {
      toast.error(t('bookSeat.selectSeatFirst'));
      return;
    }
    const ticketIds = selectedTickets.map((ticket) => ticket.id);
    const giftCardOrderSignature = JSON.stringify(['giftCard', ticketIds, selectedComboIds, giftCardCode.trim().toUpperCase()]);
    try {
      await payWithGiftCardMutation.mutateAsync({
        payload: { code: giftCardCode.trim(), ticketIds, comboIds: selectedComboIds },
        idempotencyKey: getIdempotencyKey(giftCardOrderSignature),
      });
      toast.success(t('giftCard.paySuccess'));
      dispatch(resetBookingSelection());
      navigate(ROUTES.myBookings);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('giftCard.payFailed'));
    }
  };

  const handleCheckout = async () => {
    if (selectedSeatCodes.length === 0 || selectedTickets.length === 0) {
      toast.error(t('bookSeat.selectSeatFirst'));
      return;
    }
    const ticketIds = selectedTickets.map((ticket) => ticket.id);
    const appliedVoucherCode = voucherResult ? voucherCode.trim().toUpperCase() : null;
    const appliedPromotionCode = promotionResult ? promotionCode.trim().toUpperCase() : null;
    const orderSignature = JSON.stringify([
      ticketIds,
      selectedComboIds,
      appliedVoucherCode,
      appliedPromotionCode,
      totalPrice,
    ]);
    try {
      const payUrl = await momoPaymentMutation.mutateAsync({
        payload: {
          ticketIds,
          comboIds: selectedComboIds,
          voucherCode: appliedVoucherCode,
          promotionCode: appliedPromotionCode,
          discountAmount: discount,
          totalPrice,
        },
        idempotencyKey: getIdempotencyKey(orderSignature),
      });
      dispatch(setMomoPayUrl(payUrl));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('bookSeat.checkoutFailed'));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20 text-white">
        <BookingSteps current={2} />

        <div className="mx-auto w-full max-w-7xl px-6 pb-16 md:px-10">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
                <div className="mx-auto mb-3 h-3 w-4/5 rounded-full bg-white/70 [box-shadow:0_0_30px_8px_rgba(255,255,255,0.35)]" />
                <p className="mb-8 text-center text-xs uppercase tracking-widest text-txt/50">
                  {t('bookSeat.screen')}
                </p>

                <SeatGrid scheduleId={scheduleId} roomId={scheduleDetail?.room_id ?? null} />

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-border pt-5 text-xs text-txt/80">
                  <span className="flex items-center gap-2">
                    <span
                      className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.standard])}
                    />
                    {t('bookSeat.legend.standard')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.vip])} />
                    {t('bookSeat.legend.vip')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.couple])} />
                    {t('bookSeat.legend.couple')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-6 rounded-t bg-emerald-500" />
                    {t('bookSeat.legend.selecting')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-6 rounded-t bg-white/40" />
                    {t('bookSeat.legend.held')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-6 rounded-t bg-white/25" />
                    {t('bookSeat.legend.sold')}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-5 w-6 rounded-t bg-white/10 line-through" />
                    {t('bookSeat.legend.disabled')}
                  </span>
                </div>
              </div>

              {combos.length > 0 && (
                <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
                  <h2 className="mb-4 flex items-center gap-3 text-base font-bold uppercase tracking-wide text-white">
                    <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                    {t('bookSeat.combo.title')}
                  </h2>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {combos.map((combo) => (
                      <label
                        key={combo.id}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border-strong px-3 py-2.5 text-sm text-txt/80 transition-colors hover:border-accent/60"
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedComboIds.includes(combo.id)}
                            onChange={() => dispatch(toggleCombo(combo.id))}
                          />
                          {combo.name}
                        </span>
                        <span className="font-medium text-white">
                          {combo.price.toLocaleString()}đ
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-raised lg:sticky lg:top-24">
              <h2 className="mb-4 flex items-center gap-3 text-base font-bold uppercase tracking-wide text-white">
                <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                {t('bookSeat.summaryTitle')}
              </h2>

              <div className="flex gap-3 border-b border-border pb-4">
                {movie?.avatar && (
                  <img
                    src={getMoviePosterUrl(movie.avatar)}
                    alt={movie.name}
                    className="aspect-[2/3] w-16 shrink-0 rounded-lg object-cover shadow-card"
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {movie?.name || t('bookSeat.defaultTitle')}
                  </p>
                  <p className="mt-1 text-sm text-txt/60">
                    <i className="fa-regular fa-calendar mr-1.5 text-accent" />
                    {movieDate}
                  </p>
                  <p className="mt-0.5 text-sm text-txt/60">
                    <i className="fa-regular fa-clock mr-1.5 text-accent" />
                    {timeBegin}
                  </p>
                </div>
              </div>

              <div className="border-b border-border py-4 text-sm">
                <p className="text-txt/60">{t('bookSeat.selectedSeatsLabel')}</p>
                <p className="mt-1 font-semibold text-white">
                  {selectedSeatCodes.length > 0
                    ? selectedSeatCodes.join(', ')
                    : t('bookSeat.noneSelected')}
                </p>
                {earliestHoldExpiry && (
                  <div className="mt-3">
                    <SeatHoldCountdown expiresAt={earliestHoldExpiry} onExpire={handleHoldExpire} />
                  </div>
                )}
              </div>

              <div className="border-b border-border py-4">
                <p className="mb-2 text-sm text-txt/60">{t('voucher.title')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherCode}
                    onChange={(e) => dispatch(setVoucherCode(e.target.value))}
                    placeholder={t('voucher.placeholder')}
                    disabled={!!promotionResult || !!giftCardPreview}
                    className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-soft px-3 py-2 text-sm text-txt placeholder:text-txt/35 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyVoucher}
                    disabled={!!promotionResult || !!giftCardPreview}
                  >
                    {t('voucher.apply')}
                  </Button>
                </div>
                {voucherResult && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
                    {t('voucher.applied', {
                      amount: `${voucherResult.discount_amount.toLocaleString()}đ`,
                    })}
                    <button
                      type="button"
                      onClick={() => dispatch(clearVoucher())}
                      className="text-txt/50 underline transition-colors hover:text-txt"
                    >
                      {t('voucher.remove')}
                    </button>
                  </p>
                )}
                {voucherError && <p className="mt-2 text-sm text-red-400">{voucherError}</p>}
                {promotionResult && <p className="mt-2 text-sm text-txt/50">{t('voucher.disabledHint')}</p>}
                {giftCardPreview && <p className="mt-2 text-sm text-txt/50">{t('voucher.disabledByGiftCardHint')}</p>}
              </div>

              <div className="border-b border-border py-4">
                <p className="mb-2 text-sm text-txt/60">{t('promotion.title')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promotionCode}
                    onChange={(e) => dispatch(setPromotionCode(e.target.value))}
                    placeholder={t('promotion.placeholder')}
                    disabled={!!voucherResult || !!giftCardPreview}
                    className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-soft px-3 py-2 text-sm text-txt placeholder:text-txt/35 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyPromotion}
                    disabled={!!voucherResult || !!giftCardPreview}
                  >
                    {t('promotion.apply')}
                  </Button>
                </div>
                {promotionResult && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
                    {t('promotion.applied', {
                      amount: `${promotionResult.discount_amount.toLocaleString()}đ`,
                    })}
                    <button
                      type="button"
                      onClick={() => dispatch(clearPromotion())}
                      className="text-txt/50 underline transition-colors hover:text-txt"
                    >
                      {t('promotion.remove')}
                    </button>
                  </p>
                )}
                {promotionError && <p className="mt-2 text-sm text-red-400">{promotionError}</p>}
                {voucherResult && <p className="mt-2 text-sm text-txt/50">{t('promotion.disabledHint')}</p>}
                {giftCardPreview && <p className="mt-2 text-sm text-txt/50">{t('promotion.disabledByGiftCardHint')}</p>}
              </div>

              <div className="border-b border-border py-4">
                <p className="mb-2 text-sm text-txt/60">{t('giftCard.title')}</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={giftCardCode}
                    onChange={(e) => setGiftCardCode(e.target.value)}
                    placeholder={t('giftCard.placeholder')}
                    disabled={!!voucherResult || !!promotionResult}
                    className="min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-soft px-3 py-2 text-sm text-txt placeholder:text-txt/35 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleApplyGiftCard}
                    disabled={!!voucherResult || !!promotionResult}
                    loading={validateGiftCardMutation.isPending}
                  >
                    {t('giftCard.apply')}
                  </Button>
                </div>
                {giftCardPreview && (
                  <>
                    <p className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
                      {t('giftCard.applicable', {
                        amount: `${giftCardPreview.applicable_amount.toLocaleString()}${giftCardPreview.currency}`,
                      })}
                      <button
                        type="button"
                        onClick={handleClearGiftCard}
                        className="text-txt/50 underline transition-colors hover:text-txt"
                      >
                        {t('giftCard.remove')}
                      </button>
                    </p>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={handlePayWithGiftCard}
                      loading={payWithGiftCardMutation.isPending}
                    >
                      {t('giftCard.payButton')}
                    </Button>
                  </>
                )}
                {giftCardError && <p className="mt-2 text-sm text-red-400">{giftCardError}</p>}
                {(voucherResult || promotionResult) && (
                  <p className="mt-2 text-sm text-txt/50">{t('giftCard.disabledHint')}</p>
                )}
              </div>

              <div className="flex items-end justify-between py-4">
                <span className="text-sm uppercase tracking-wide text-txt/60">
                  {t('bookSeat.totalLabel')}
                </span>
                <span className="text-2xl font-bold text-accent">
                  {totalPrice.toLocaleString()}đ
                </span>
              </div>

              <Button
                type="button"
                className="w-full uppercase"
                size="lg"
                onClick={handleCheckout}
                loading={momoPaymentMutation.isPending}
              >
                {t('bookSeat.checkout')}
              </Button>
            </aside>
          </div>
        </div>
      </div>
      <Footer />

      {momoPayUrl && (
        <Modal
          open
          onClose={() => dispatch(setMomoPayUrl(''))}
          title={t('bookSeat.momoModal.title')}
        >
          <div className="grid grid-cols-1 gap-6 text-txt sm:grid-cols-2">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border-strong p-4 text-center">
              <p className="font-semibold text-white">{t('bookSeat.momoModal.qrTitle')}</p>
              <div className="rounded-md bg-white p-3">
                <QRCodeSVG value={momoPayUrl} size={180} />
              </div>
              <p className="text-sm text-txt/60">{t('bookSeat.momoModal.qrDescription')}</p>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border-strong p-4 text-center">
              <p className="font-semibold text-white">{t('bookSeat.momoModal.testAccountTitle')}</p>
              <p className="text-sm text-txt/60">
                {t('bookSeat.momoModal.testAccountDescription')}
              </p>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  window.location.href = momoPayUrl;
                }}
              >
                {t('bookSeat.momoModal.openButton')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default BookSeatPage;
