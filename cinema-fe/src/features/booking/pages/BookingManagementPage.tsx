import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { BOOKING_STATUS_META, CANCELLABLE_BOOKING_STATUSES } from '@/constants/bookingStatus';
import { CustomerPicker } from '@/features/customerService/components/CustomerPicker';
import { getPaymentStatus } from '@/features/payment/api/payment.api';
import type { User } from '@/types/entities';
import type { Booking } from '../types/booking.types';
import { useBookings } from '../hooks/useBookings';
import { useCancelBooking } from '../hooks/useCancelBooking';
import { useRespondToReschedule } from '../hooks/useRespondToReschedule';
import { useRequestRefund } from '@/features/refund/hooks/useRequestRefund';
import { ChangeShowtimeModal } from '../components/ChangeShowtimeModal';

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
        {bookings.map((booking) => {
          const status = BOOKING_STATUS_META[booking.status] || BOOKING_STATUS_META.PENDING;
          const seatCodes = booking.tickets.map((ticket) => ticket.seat_code).join(', ');
          return (
            <tr key={booking.id}>
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
                    onClick={() => handleCancel(booking.id)}
                  >
                    {t('bookingManagement.cancel')}
                  </button>
                )}
                {canRequestRefund && booking.status === 'PAID' && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => setRefundBookingId(booking.id)}
                  >
                    {t('bookingManagement.requestRefund')}
                  </button>
                )}
                {canRespondReschedule && booking.needs_reschedule_response && (
                  <>
                    <button
                      type="button"
                      className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                      onClick={() => handleRespondReschedule(booking.id, 'ACCEPT')}
                    >
                      {t('bookingManagement.acceptReschedule')}
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-red-400 transition-colors hover:text-red-300"
                      onClick={() => handleRespondReschedule(booking.id, 'REFUND')}
                    >
                      {t('bookingManagement.declineReschedule')}
                    </button>
                  </>
                )}
                {canChangeShowtime && CANCELLABLE_BOOKING_STATUSES.includes(booking.status) && booking.movie && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => setChangeShowtimeBooking(booking)}
                  >
                    {t('bookingManagement.changeShowtime')}
                  </button>
                )}
                {canCheckPayment && (
                  <button
                    type="button"
                    className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                    onClick={() => handleCheckPayment(booking.code)}
                  >
                    {t('bookingManagement.checkPayment')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      <Modal
        open={refundBookingId !== null}
        onClose={() => setRefundBookingId(null)}
        title={t('bookingManagement.refundModalTitle')}
      >
        <Textarea
          label={t('bookingManagement.refundReasonLabel')}
          value={refundReason}
          onChange={(e) => setRefundReason(e.target.value)}
          rows={3}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => setRefundBookingId(null)}>
            {t('common:actions.close')}
          </Button>
          <Button type="button" variant="danger" loading={refundMutation.isPending} onClick={submitRefundRequest}>
            {t('common:actions.confirm')}
          </Button>
        </div>
      </Modal>

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
