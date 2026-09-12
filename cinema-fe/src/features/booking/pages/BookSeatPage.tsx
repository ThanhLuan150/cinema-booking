import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { BookingSteps } from '../components/BookingSteps';
import { SeatMapCard } from '../components/SeatMapCard';
import { ComboSelector } from '../components/ComboSelector';
import { BookingSummarySidebar } from '../components/BookingSummarySidebar';
import { MomoPaymentModal } from '../components/MomoPaymentModal';
import { useScheduleId } from '../hooks/useScheduleId';
import { useRoomSeats } from '../hooks/useRoomSeats';
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
  resetBookingSelection,
  setbranchId,
  setMomoPayUrl,
  setScheduleId,
  setShowtime,
} from '../store/bookingSlice';
import { ROUTES } from '@/constants/routes';

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
              <SeatMapCard scheduleId={scheduleId} roomId={scheduleDetail?.room_id ?? null} />

              <ComboSelector combos={combos} selectedComboIds={selectedComboIds} />
            </div>

            <BookingSummarySidebar
              movie={movie}
              movieDate={movieDate}
              timeBegin={timeBegin}
              selectedSeatCodes={selectedSeatCodes}
              earliestHoldExpiry={earliestHoldExpiry}
              onHoldExpire={handleHoldExpire}
              voucherCode={voucherCode}
              voucherResult={voucherResult}
              voucherError={voucherError}
              onApplyVoucher={handleApplyVoucher}
              promotionCode={promotionCode}
              promotionResult={promotionResult}
              promotionError={promotionError}
              onApplyPromotion={handleApplyPromotion}
              giftCardCode={giftCardCode}
              giftCardPreview={giftCardPreview}
              giftCardError={giftCardError}
              giftCardApplyLoading={validateGiftCardMutation.isPending}
              giftCardPayLoading={payWithGiftCardMutation.isPending}
              onChangeGiftCardCode={setGiftCardCode}
              onApplyGiftCard={handleApplyGiftCard}
              onClearGiftCard={handleClearGiftCard}
              onPayWithGiftCard={handlePayWithGiftCard}
              totalPrice={totalPrice}
              onCheckout={handleCheckout}
              checkoutLoading={momoPaymentMutation.isPending}
            />
          </div>
        </div>
      </div>
      <Footer />

      {momoPayUrl && (
        <MomoPaymentModal payUrl={momoPayUrl} onClose={() => dispatch(setMomoPayUrl(''))} />
      )}
    </div>
  );
}

export default BookSeatPage;
