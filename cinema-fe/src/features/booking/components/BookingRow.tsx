import { useTranslation } from 'react-i18next';
import { BOOKING_STATUS_META, CANCELLABLE_BOOKING_STATUSES } from '@/constants/bookingStatus';
import type { Booking } from '../types/booking.types';

export function BookingRow({
  booking,
  canCancel,
  canRequestRefund,
  canRespondReschedule,
  canChangeShowtime,
  canCheckPayment,
  onCancel,
  onRequestRefund,
  onRespondReschedule,
  onChangeShowtime,
  onCheckPayment,
}: {
  booking: Booking;
  canCancel: boolean;
  canRequestRefund: boolean;
  canRespondReschedule: boolean;
  canChangeShowtime: boolean;
  canCheckPayment: boolean;
  onCancel: (id: number) => void;
  onRequestRefund: (id: number) => void;
  onRespondReschedule: (id: number, action: 'ACCEPT' | 'REFUND') => void;
  onChangeShowtime: (booking: Booking) => void;
  onCheckPayment: (code: string) => void;
}) {
  const { t } = useTranslation('booking');
  const status = BOOKING_STATUS_META[booking.status] || BOOKING_STATUS_META.PENDING;
  const seatCodes = booking.tickets.map((ticket) => ticket.seat_code).join(', ');

  return (
    <tr>
      <td>{booking.id}</td>
      <td>{booking.code}</td>
      <td>{booking.account?.email}</td>
      <td>{booking.movie?.name}</td>
      <td>{seatCodes}</td>
      <td>{booking.total_price.toLocaleString()}đ</td>
      <td>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${status.className}`}>
          {t(`myBookings.status.${status.key}`)}
        </span>
      </td>
      <td className="flex flex-wrap gap-3">
        {canCancel && CANCELLABLE_BOOKING_STATUSES.includes(booking.status) && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onCancel(booking.id)}
          >
            {t('bookingManagement.cancel')}
          </button>
        )}
        {canRequestRefund && booking.status === 'PAID' && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onRequestRefund(booking.id)}
          >
            {t('bookingManagement.requestRefund')}
          </button>
        )}
        {canRespondReschedule && booking.needs_reschedule_response && (
          <>
            <button
              type="button"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
              onClick={() => onRespondReschedule(booking.id, 'ACCEPT')}
            >
              {t('bookingManagement.acceptReschedule')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
              onClick={() => onRespondReschedule(booking.id, 'REFUND')}
            >
              {t('bookingManagement.declineReschedule')}
            </button>
          </>
        )}
        {canChangeShowtime && CANCELLABLE_BOOKING_STATUSES.includes(booking.status) && booking.movie && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onChangeShowtime(booking)}
          >
            {t('bookingManagement.changeShowtime')}
          </button>
        )}
        {canCheckPayment && (
          <button
            type="button"
            className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
            onClick={() => onCheckPayment(booking.code)}
          >
            {t('bookingManagement.checkPayment')}
          </button>
        )}
      </td>
    </tr>
  );
}
