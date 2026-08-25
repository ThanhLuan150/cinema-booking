import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useBookings } from '../hooks/useBookings';
import { useCancelBooking } from '../hooks/useCancelBooking';
import { useRespondToReschedule } from '../hooks/useRespondToReschedule';
import { useMyRefunds } from '@/features/refund/hooks/useMyRefunds';
import { useRequestRefund } from '@/features/refund/hooks/useRequestRefund';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { BOOKING_STATUS, BOOKING_STATUS_META, CANCELLABLE_BOOKING_STATUSES } from '@/constants/bookingStatus';
import { ACTIVE_REFUND_STATUSES } from '@/constants/refundStatus';
import { ROUTES } from '@/constants/routes';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

function MyBookingsPage() {
  const { t } = useTranslation('booking');
  const { data, isLoading } = useBookings();
  const bookings = data?.data ?? [];
  const cancelBookingMutation = useCancelBooking();
  const respondToRescheduleMutation = useRespondToReschedule();
  const requestRefundMutation = useRequestRefund();
  const { data: refundsData } = useMyRefunds(1, FULL_LIST_FETCH_LIMIT);
  const activeRefundBookingIds = new Set(
    (refundsData?.data ?? [])
      .filter((refund) => ACTIVE_REFUND_STATUSES.includes(refund.status))
      .map((refund) => refund.booking_id),
  );

  const handleRequestRefund = async (bookingId: number) => {
    if (!(await confirmDialog(t('myBookings.requestRefundConfirm')))) return;
    try {
      await requestRefundMutation.mutateAsync({ bookingId });
      toast.success(t('myBookings.requestRefundSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleCancel = async (bookingId: number) => {
    if (!(await confirmDialog(t('myBookings.confirmCancel')))) return;
    try {
      await cancelBookingMutation.mutateAsync(bookingId);
      toast.success(t('myBookings.cancelSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('myBookings.cancelFailed'));
    }
  };

  const handleAcceptReschedule = async (bookingId: number) => {
    try {
      await respondToRescheduleMutation.mutateAsync({ bookingId, action: 'ACCEPT' });
      toast.success(t('myBookings.rescheduleBanner.acceptSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('myBookings.rescheduleBanner.failed'));
    }
  };

  const handleRefundReschedule = async (bookingId: number) => {
    if (!(await confirmDialog(t('myBookings.rescheduleBanner.refundConfirm')))) return;
    try {
      await respondToRescheduleMutation.mutateAsync({ bookingId, action: 'REFUND' });
      toast.success(t('myBookings.rescheduleBanner.refundSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('myBookings.rescheduleBanner.failed'));
    }
  };

  return (
    <AccountLayout title={t('myBookings.pageTitle')}>
      <style>{`
        @media print {
          header, footer, .no-print { display: none !important; }
          .booking-card { break-inside: avoid; }
        }
      `}</style>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}
      {!isLoading && bookings.length === 0 && (
        <EmptyState title={t('myBookings.empty')} icon="fa-solid fa-ticket" />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {bookings.map((booking) => {
          const status = BOOKING_STATUS_META[booking.status] || BOOKING_STATUS_META.PENDING;
          const canCancel = CANCELLABLE_BOOKING_STATUSES.includes(booking.status);
          const hasActiveRefund = activeRefundBookingIds.has(booking.id);
          // Skip while a reschedule decision is pending: that banner already offers its own
          // accept/refund choice via respondToReschedule, a separate flow from this one.
          const canRequestRefund =
            booking.status === BOOKING_STATUS.paid && !hasActiveRefund && !booking.needs_reschedule_response;
          const seatsSummary = booking.tickets
            .map((ticket) => `${ticket.seat_code} (${t(`myBookings.seatType.${SEAT_TYPE_KEY[ticket.seat_type] ?? 'standard'}`)})`)
            .join(', ');
          return (
            <div
              key={booking.id}
              className="booking-card flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-card"
            >
              <img
                src={getMoviePosterUrl(booking.movie?.avatar)}
                alt={booking.movie?.name}
                className="h-[140px] w-[100px] shrink-0 rounded-lg object-cover shadow-card"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h6 className="text-lg font-semibold text-white">
                    {booking.movie?.name || t('myBookings.movieFallback')}
                  </h6>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',
                      status.className,
                    )}
                  >
                    {t(`myBookings.status.${status.key}`)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-txt/70">
                  {booking.schedule?.movie_date} · {booking.schedule?.time_begin}
                </p>
                {booking.needs_reschedule_response && (
                  <div className="no-print mt-2 rounded-lg border border-amber-700/50 bg-amber-500/10 p-3">
                    <p className="text-sm text-amber-300">{t('myBookings.rescheduleBanner.message')}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
                        onClick={() => handleAcceptReschedule(booking.id)}
                      >
                        {t('myBookings.rescheduleBanner.acceptButton')}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-800/60 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                        onClick={() => handleRefundReschedule(booking.id)}
                      >
                        {t('myBookings.rescheduleBanner.refundButton')}
                      </button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-txt/70">{t('myBookings.seatsLabel', { codes: seatsSummary })}</p>
                <p className="text-sm text-txt/70">{t('myBookings.bookingCode', { code: booking.code })}</p>
                {booking.discount_amount > 0 && (
                  <p className="text-sm text-accent">
                    {t('myBookings.discount', {
                      amount: `${booking.discount_amount.toLocaleString()}đ`,
                    })}
                  </p>
                )}
                <p className="mt-1 font-semibold text-white">{booking.total_price.toLocaleString()}đ</p>

                <div className="no-print mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    to={ROUTES.myTickets}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white no-underline shadow-card transition-colors hover:bg-accent-hover"
                  >
                    <i className="fa-solid fa-qrcode mr-1" />
                    {t('myBookings.viewTickets')}
                  </Link>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-txt transition-colors hover:bg-white/5"
                    onClick={() => window.print()}
                  >
                    <i className="fa-solid fa-print mr-1" />
                    {t('myBookings.print')}
                  </button>
                  {canCancel && (
                    <button
                      type="button"
                      className="rounded-lg border border-red-800/60 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
                      onClick={() => handleCancel(booking.id)}
                    >
                      {t('myBookings.cancel')}
                    </button>
                  )}
                  {canRequestRefund && (
                    <button
                      type="button"
                      className="rounded-lg border border-amber-700/60 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
                      onClick={() => handleRequestRefund(booking.id)}
                    >
                      {t('myBookings.requestRefund')}
                    </button>
                  )}
                  {hasActiveRefund && (
                    <span className="rounded-lg border border-amber-700/60 px-3 py-1.5 text-xs font-medium text-amber-400">
                      {t('myBookings.refundInProgress')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AccountLayout>
  );
}

export default MyBookingsPage;
