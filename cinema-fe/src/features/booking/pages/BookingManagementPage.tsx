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
import { BOOKING_STATUS_META, CANCELLABLE_BOOKING_STATUSES } from '@/constants/bookingStatus';
import { useBookings } from '../hooks/useBookings';
import { useCancelBooking } from '../hooks/useCancelBooking';

function BookingManagementPage() {
  const { t } = useTranslation('booking');
  const [page, setPage] = useState(1);
  const { data } = useBookings({ page, limit: DEFAULT_PAGE_SIZE });
  const bookings = data?.data ?? [];
  const { hasPermission } = usePermissions();
  const cancelMutation = useCancelBooking();

  const canCancel = hasPermission('booking.cancel');

  const handleCancel = async (id: number) => {
    if (!(await confirmDialog(t('bookingManagement.confirmCancel')))) return;
    try {
      await cancelMutation.mutateAsync(id);
      toast.success(t('bookingManagement.cancelSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t) || t('bookingManagement.cancelFailed'));
    }
  };

  return (
    <AdminLayout breadcrumb={t('bookingManagement.breadcrumb')}>
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
              <td>
                {canCancel && CANCELLABLE_BOOKING_STATUSES.includes(booking.status) && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleCancel(booking.id)}
                  >
                    {t('bookingManagement.cancel')}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default BookingManagementPage;
