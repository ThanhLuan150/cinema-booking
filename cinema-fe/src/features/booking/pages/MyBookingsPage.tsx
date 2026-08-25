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
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { BOOKING_STATUS_META, CANCELLABLE_BOOKING_STATUSES } from '@/constants/bookingStatus';
import { ROUTES } from '@/constants/routes';

function MyBookingsPage() {
  const { t } = useTranslation('booking');
  const { data, isLoading } = useBookings();
  const bookings = data?.data ?? [];
  const cancelBookingMutation = useCancelBooking();

  const handleCancel = async (bookingId: number) => {
    if (!(await confirmDialog(t('myBookings.confirmCancel')))) return;
    try {
      await cancelBookingMutation.mutateAsync(bookingId);
      toast.success(t('myBookings.cancelSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('myBookings.cancelFailed'));
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
