import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { RescheduleBanner } from './RescheduleBanner';
import { SEAT_TYPE_KEY } from '@/constants/seatType';
import { BOOKING_STATUS, BOOKING_STATUS_META, CANCELLABLE_BOOKING_STATUSES } from '@/constants/bookingStatus';
import { ROUTES } from '@/constants/routes';
import type { Booking } from '../types/booking.types';

export function BookingCard({
  booking,
  hasActiveRefund,
  onCancel,
  onRequestRefund,
  onAcceptReschedule,
  onRefundReschedule,
}: {
  booking: Booking;
  hasActiveRefund: boolean;
  onCancel: (bookingId: number) => void;
  onRequestRefund: (bookingId: number) => void;
  onAcceptReschedule: (bookingId: number) => void;
  onRefundReschedule: (bookingId: number) => void;
}) {
  const { t } = useTranslation('booking');

  const status = BOOKING_STATUS_META[booking.status] || BOOKING_STATUS_META.PENDING;
  const canCancel = CANCELLABLE_BOOKING_STATUSES.includes(booking.status);
  // Skip while a reschedule decision is pending: that banner already offers its own
  // accept/refund choice via respondToReschedule, a separate flow from this one.
  const canRequestRefund =
    booking.status === BOOKING_STATUS.paid && !hasActiveRefund && !booking.needs_reschedule_response;
  const seatsSummary = booking.tickets
    .map((ticket) => `${ticket.seat_code} (${t(`myBookings.seatType.${SEAT_TYPE_KEY[ticket.seat_type] ?? 'standard'}`)})`)
    .join(', ');

  return (
    <div className="booking-card flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-card">
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
          <RescheduleBanner
            onAccept={() => onAcceptReschedule(booking.id)}
            onRefund={() => onRefundReschedule(booking.id)}
          />
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
              onClick={() => onCancel(booking.id)}
            >
              {t('myBookings.cancel')}
            </button>
          )}
          {canRequestRefund && (
            <button
              type="button"
              className="rounded-lg border border-amber-700/60 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/10"
              onClick={() => onRequestRefund(booking.id)}
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
}
