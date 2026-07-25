import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { useScheduleId } from '../hooks/useScheduleId';
import { useBookedSeats } from '../hooks/useBookedSeats';
import { useScheduleDetail } from '../hooks/useScheduleDetail';
import { useRoomsList } from '../hooks/useRoomsList';
import { useCombos } from '../hooks/useCombos';
import { useValidateVoucher } from '../hooks/useValidateVoucher';
import { useMomoPayment } from '../hooks/useMomoPayment';
import {
  applyVoucherFailure,
  applyVoucherSuccess,
  resetBookingSelection,
  setCinemaId,
  setMomoPayUrl,
  setScheduleId,
  setShowtime,
  setVoucherCode,
  toggleCombo,
  toggleSeat,
} from '../store/bookingSlice';
import type { BookedSeatTicket } from '../types/booking.types';
import { SEAT_TYPE_CLASS, SEAT_TYPE_KEY, SEAT_TYPE_MULTIPLIER, SEAT_TYPES } from '@/constants/seatType';
import { TICKET_STATUS } from '@/constants/ticketStatus';
import { ROUTES } from '@/constants/routes';

function priceForSeatType(basePrice: number, seatType: number) {
  return Math.round(basePrice * (SEAT_TYPE_MULTIPLIER[seatType] ?? 1));
}

function SeatGrid({ scheduleId }: { scheduleId: number | null }) {
  const { t } = useTranslation('booking');
  const dispatch = useAppDispatch();
  const selectedSeatCodes = useAppSelector((state) => state.booking.selectedSeatCodes);
  const { data: ticketList = [], isLoading } = useBookedSeats(scheduleId);

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

  const rows: Record<string, BookedSeatTicket[]> = {};
  for (const ticket of ticketList) {
    const match = ticket.seat_code.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) continue;
    const rowLetter = match[1];
    if (!rows[rowLetter]) rows[rowLetter] = [];
    rows[rowLetter].push(ticket);
  }
  for (const rowLetter of Object.keys(rows)) {
    rows[rowLetter].sort((a, b) => Number(a.seat_code.slice(rowLetter.length)) - Number(b.seat_code.slice(rowLetter.length)));
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {Object.keys(rows).sort().map((rowLetter) => (
        <div className="flex gap-1" key={rowLetter}>
          {rows[rowLetter].map((ticket) => {
            const isSelected = selectedSeatCodes.includes(ticket.seat_code);
            const isSold = ticket.status === TICKET_STATUS.sold;
            return (
              <button
                type="button"
                key={ticket.seat_code}
                title={t(`bookSeat.legend.${SEAT_TYPE_KEY[ticket.seat_type] ?? 'standard'}`)}
                className={cn(
                  'flex h-8 w-9 items-center justify-center rounded-t-lg text-[10px] font-medium text-black transition-transform',
                  isSold ? 'cursor-not-allowed bg-white/40' : cn('cursor-pointer hover:scale-110', SEAT_TYPE_CLASS[ticket.seat_type] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard]),
                  isSelected && 'scale-110 bg-green-500 text-white ring-2 ring-white',
                )}
                onClick={() => {
                  if (isSold) return;
                  dispatch(toggleSeat(ticket));
                }}
              >
                {ticket.seat_code}
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
  const [searchParams] = useSearchParams();
  const isLoggedIn = useIsAuthenticated();

  const movieId = searchParams.get('movieId') ?? '';
  const movieDate = searchParams.get('day') ?? '';
  const timeBegin = searchParams.get('time') ?? '';

  const { scheduleId, selectedSeatCodes, selectedTickets, selectedComboIds, cinemaId, voucherCode, voucherResult, voucherError, momoPayUrl } =
    useAppSelector((state) => state.booking);

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
    movieId && movieDate && timeBegin ? { movie_id: movieId, movie_date: movieDate, time_begin: timeBegin } : null,
  );
  useEffect(() => {
    if (resolvedSchedule?.id) dispatch(setScheduleId(resolvedSchedule.id));
  }, [resolvedSchedule, dispatch]);

  const { data: scheduleDetail } = useScheduleDetail(scheduleId);
  const { data: rooms = [] } = useRoomsList(!!scheduleDetail?.room_id);
  useEffect(() => {
    if (!scheduleDetail?.room_id || rooms.length === 0) return;
    const room = rooms.find((r) => r.id === scheduleDetail.room_id);
    if (room) dispatch(setCinemaId(room.cinema_id));
  }, [scheduleDetail, rooms, dispatch]);

  const { data: movie } = useMovieDetail(movieId);

  const { data: combos = [] } = useCombos();
  const validateVoucherMutation = useValidateVoucher();
  const momoPaymentMutation = useMomoPayment();

  const seatTotal = useMemo(() => {
    if (!scheduleDetail) return 0;
    return selectedTickets.reduce((sum, ticket) => sum + priceForSeatType(scheduleDetail.price, ticket.seat_type), 0);
  }, [scheduleDetail, selectedTickets]);

  const comboTotal = combos
    .filter((c) => selectedComboIds.includes(c.id))
    .reduce((sum, c) => sum + c.price, 0);
  const discount = voucherResult?.discount_amount ?? 0;
  const totalPrice = Math.max(seatTotal + comboTotal - discount, 0);

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    try {
      const result = await validateVoucherMutation.mutateAsync({
        code: voucherCode.trim(),
        cinema_id: cinemaId,
        order_value: seatTotal + comboTotal,
      });
      dispatch(applyVoucherSuccess(result));
    } catch (error) {
      dispatch(applyVoucherFailure(getApiErrorMessage(error, t) || t('voucher.applyFailed')));
    }
  };

  // Both "Đặt vé ngay" and "Thanh toán" go through the same MoMo checkout — the seat
  // is only actually marked sold once MoMo confirms payment (see PaymentResultPage),
  // not the moment this button is clicked. Instead of redirecting immediately, we get
  // the real MoMo payUrl and let the user pick how to pay: scan it as a QR with the
  // MoMo app on their phone, or open MoMo's own page and log in with a test account.
  const handleCheckout = async () => {
    if (selectedSeatCodes.length === 0 || selectedTickets.length === 0) {
      toast.error(t('bookSeat.selectSeatFirst'));
      return;
    }
    try {
      const payUrl = await momoPaymentMutation.mutateAsync({
        ticketIds: selectedTickets.map((ticket) => ticket.id),
        comboIds: selectedComboIds,
        voucherCode: voucherResult ? voucherCode.trim().toUpperCase() : null,
        discountAmount: discount,
        totalPrice,
      });
      dispatch(setMomoPayUrl(payUrl));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('bookSeat.checkoutFailed'));
    }
  };

  return (
    <div className="min-h-screen bg-main px-4 pb-16 pt-24 text-white">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-center text-xl font-semibold">{movie?.name || t('bookSeat.defaultTitle')}</h1>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 rounded-lg bg-white/5 px-4 py-3 text-xs text-white/80">
          <span className="flex items-center gap-2">
            <span className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.standard])} /> {t('bookSeat.legend.standard')}
          </span>
          <span className="flex items-center gap-2">
            <span className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.vip])} /> {t('bookSeat.legend.vip')}
          </span>
          <span className="flex items-center gap-2">
            <span className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.couple])} /> {t('bookSeat.legend.couple')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-5 w-6 rounded-t bg-green-500" /> {t('bookSeat.legend.selecting')}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-5 w-6 rounded-t bg-white/40" /> {t('bookSeat.legend.sold')}
          </span>
        </div>

        <div className="mt-8 rounded-xl bg-white/5 p-6">
          <div className="mx-auto mb-8 h-3 w-4/5 rounded-full bg-white/70 [box-shadow:0_0_30px_8px_rgba(255,255,255,0.35)]" />
          <p className="mb-6 text-center text-xs text-white/50">{t('bookSeat.screen')}</p>

          <SeatGrid scheduleId={scheduleId} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {combos.length > 0 && (
            <div className="rounded-xl bg-white/5 p-4">
              <h6 className="mb-3 font-semibold text-white">{t('bookSeat.combo.title')}</h6>
              <div className="flex flex-col gap-2">
                {combos.map((combo) => (
                  <label key={combo.id} className="flex items-center justify-between text-sm text-white/80">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedComboIds.includes(combo.id)}
                        onChange={() => dispatch(toggleCombo(combo.id))}
                      />
                      {combo.name}
                    </span>
                    <span>{combo.price.toLocaleString()}đ</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl bg-white/5 p-4">
            <h6 className="mb-3 font-semibold text-white">{t('voucher.title')}</h6>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => dispatch(setVoucherCode(e.target.value))}
                placeholder={t('voucher.placeholder')}
                className="flex-1 rounded-md px-3 py-2 text-sm text-main"
              />
              <Button type="button" variant="secondary" size="sm" onClick={handleApplyVoucher}>
                {t('voucher.apply')}
              </Button>
            </div>
            {voucherResult && (
              <p className="mt-2 text-sm text-green-400">
                {t('voucher.applied', { amount: `${voucherResult.discount_amount.toLocaleString()}đ` })}
              </p>
            )}
            {voucherError && <p className="mt-2 text-sm text-red-400">{voucherError}</p>}
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center gap-4 rounded-xl bg-white/5 p-6 sm:flex-row sm:justify-between">
          <div>
            <p className="text-sm text-white/60">
              {t('bookSeat.selectedSeatsLabel')} <span className="text-white">{selectedSeatCodes.length > 0 ? selectedSeatCodes.join(', ') : t('bookSeat.noneSelected')}</span>
            </p>
            <p className="mt-1 text-2xl font-bold text-green-400">{totalPrice.toLocaleString()}đ</p>
          </div>
          <Button type="button" variant="danger" onClick={handleCheckout} loading={momoPaymentMutation.isPending}>
            {t('bookSeat.checkout')}
          </Button>
        </div>
      </div>

      {momoPayUrl && (
        <Modal open onClose={() => dispatch(setMomoPayUrl(''))} title={t('bookSeat.momoModal.title')}>
          <div className="grid grid-cols-1 gap-6 text-main sm:grid-cols-2">
            <div className="flex flex-col items-center gap-3 rounded-lg border border-txt/20 p-4 text-center">
              <p className="font-semibold">{t('bookSeat.momoModal.qrTitle')}</p>
              <div className="rounded-md bg-white p-3">
                <QRCodeSVG value={momoPayUrl} size={180} />
              </div>
              <p className="text-sm text-gray-500">
                {t('bookSeat.momoModal.qrDescription')}
              </p>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-txt/20 p-4 text-center">
              <p className="font-semibold">{t('bookSeat.momoModal.testAccountTitle')}</p>
              <p className="text-sm text-gray-500">
                {t('bookSeat.momoModal.testAccountDescription')}
              </p>
              <Button type="button" variant="danger" onClick={() => { window.location.href = momoPayUrl; }}>
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
