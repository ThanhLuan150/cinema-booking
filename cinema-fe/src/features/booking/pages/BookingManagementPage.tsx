import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { CustomerPicker } from '@/features/customerService/components/CustomerPicker';
import { getPaymentStatus } from '@/features/payment/api/payment.api';
import type { User } from '@/types/entities';
import type { Booking } from '../types/booking.types';
import { useBookings } from '../hooks/useBookings';
import { useCancelBooking } from '../hooks/useCancelBooking';
import { useRespondToReschedule } from '../hooks/useRespondToReschedule';
import { useRequestRefund } from '@/features/refund/hooks/useRequestRefund';
import { ChangeShowtimeModal } from '../components/ChangeShowtimeModal';
import { BookingRow } from '../components/BookingRow';
import { RefundRequestModal } from '../components/RefundRequestModal';

function BookingManagementPage() {
  const { t } = useTranslation('booking');
  const [page, setPage] = useState(1);
  const [customer, setCustomer] = useState<User | null>(null);
  const [refundBookingId, setRefundBookingId] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [changeShowtimeBooking, setChangeShowtimeBooking] = useState<Booking | null>(null);
  const { data, isLoading } = useBookings({ page, limit: DEFAULT_PAGE_SIZE, accountId: customer?.id });
  const bookings = data?.data ?? [];
  const { hasPermission } = usePermissions();
  const cancelMutation = useCancelBooking();
  const refundMutation = useRequestRefund();
  const rescheduleMutation = useRespondToReschedule();

  const canCancel = hasPermission('booking.cancel');
  const canRequestRefund = hasPermission('refund.request');
  const canRespondReschedule = hasPermission('booking.reschedule');
  const canCheckPayment = hasPermission('payment.read');
  const canSearchCustomer = hasPermission('user.read');
  const canChangeShowtime = hasPermission('booking.changeShowtime');

  const handleCancel = async (id: number) => {
    if (!(await confirmDialog(t('bookingManagement.confirmCancel')))) return;
    try {
      await cancelMutation.mutateAsync(id);
      toast.success(t('bookingManagement.cancelSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('bookingManagement.cancelFailed'));
    }
  };

  const handleRespondReschedule = async (id: number, action: 'ACCEPT' | 'REFUND') => {
    try {
      await rescheduleMutation.mutateAsync({ bookingId: id, action });
      toast.success(t('bookingManagement.rescheduleSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleCheckPayment = async (code: string) => {
    try {
      const payment = await getPaymentStatus(code);
      toast.info(t('bookingManagement.paymentStatusResult', { status: payment.status, amount: payment.amount.toLocaleString() }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const submitRefundRequest = async () => {
    if (refundBookingId === null) return;
    try {
      await refundMutation.mutateAsync({ bookingId: refundBookingId, reason: refundReason.trim() || undefined });
      toast.success(t('bookingManagement.refundRequestSuccess'));
      setRefundBookingId(null);
      setRefundReason('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('bookingManagement.breadcrumb')} loading={isLoading}>
      {canSearchCustomer && (
        <div className="mb-4 max-w-sm">
          <CustomerPicker selected={customer} onSelect={setCustomer} />
        </div>
      )}
      <DataTable headers={t('bookingManagement.headers', { returnObjects: true }) as unknown as string[]}>
        {bookings.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            canCancel={canCancel}
            canRequestRefund={canRequestRefund}
            canRespondReschedule={canRespondReschedule}
            canChangeShowtime={canChangeShowtime}
            canCheckPayment={canCheckPayment}
            onCancel={handleCancel}
            onRequestRefund={setRefundBookingId}
            onRespondReschedule={handleRespondReschedule}
            onChangeShowtime={setChangeShowtimeBooking}
            onCheckPayment={handleCheckPayment}
          />
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      <RefundRequestModal
        open={refundBookingId !== null}
        reason={refundReason}
        onChangeReason={setRefundReason}
        onClose={() => setRefundBookingId(null)}
        onSubmit={submitRefundRequest}
        submitting={refundMutation.isPending}
      />

      {changeShowtimeBooking && (
        <ChangeShowtimeModal
          booking={changeShowtimeBooking}
          onClose={() => setChangeShowtimeBooking(null)}
          onSuccess={() => {
            toast.success(t('bookingManagement.changeShowtimeSuccess'));
            setChangeShowtimeBooking(null);
          }}
        />
      )}
    </AdminLayout>
  );
}

export default BookingManagementPage;
