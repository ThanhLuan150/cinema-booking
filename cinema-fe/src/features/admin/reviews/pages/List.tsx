import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useAdminReviews } from '../hooks/useAdminReviews';
import { useDeleteReview, useHideReview, useRejectReview, useRestoreReview } from '../hooks/useReviewModeration';
import { ListItem } from '../components/ListItem';

function AdminReviews() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminReviews(page, DEFAULT_PAGE_SIZE);
  const reviews = data?.data ?? [];
  const hideMutation = useHideReview();
  const rejectMutation = useRejectReview();
  const restoreMutation = useRestoreReview();
  const deleteMutation = useDeleteReview();

  const handleHide = useCallback(
    async (id: number) => {
      try {
        await hideMutation.mutateAsync(id);
        toast.success(t('reviews.hideSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [hideMutation, t],
  );

  const handleReject = useCallback(
    async (id: number) => {
      try {
        await rejectMutation.mutateAsync(id);
        toast.success(t('reviews.rejectSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [rejectMutation, t],
  );

  const handleRestore = useCallback(
    async (id: number) => {
      try {
        await restoreMutation.mutateAsync(id);
        toast.success(t('reviews.restoreSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [restoreMutation, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('reviews.deleteConfirm')))) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(t('reviews.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteMutation, t],
  );

  return (
    <AdminLayout breadcrumb={t('reviews.breadcrumb')} loading={isLoading}>
      <DataTable headers={t('reviews.headers', { returnObjects: true }) as unknown as string[]}>
        {reviews.map((review) => (
          <ListItem
            key={review.id}
            review={review}
            onHide={handleHide}
            onReject={handleReject}
            onRestore={handleRestore}
            onDelete={handleDelete}
          />
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default AdminReviews;
