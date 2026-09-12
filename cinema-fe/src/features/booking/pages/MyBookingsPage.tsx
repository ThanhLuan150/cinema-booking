import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useBookings } from '../hooks/useBookings';
import { useCancelBooking } from '../hooks/useCancelBooking';
import { useRespondToReschedule } from '../hooks/useRespondToReschedule';
import { useMyRefunds } from '@/features/refund/hooks/useMyRefunds';
import { useRequestRefund } from '@/features/refund/hooks/useRequestRefund';
import { BookingCard } from '../components/BookingCard';
import { ACTIVE_REFUND_STATUSES } from '@/constants/refundStatus';
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
        {bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            hasActiveRefund={activeRefundBookingIds.has(booking.id)}
            onCancel={handleCancel}
            onRequestRefund={handleRequestRefund}
            onAcceptReschedule={handleAcceptReschedule}
            onRefundReschedule={handleRefundReschedule}
          />
        ))}
      </div>
    </AccountLayout>
  );
}

export default MyBookingsPage;
