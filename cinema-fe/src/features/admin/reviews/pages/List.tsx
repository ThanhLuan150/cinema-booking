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

  const statusLabel = (status: string) => {
    if (status === 'HIDDEN') return t('reviews.hiddenStatus');
    if (status === 'REJECTED') return t('reviews.rejectedStatus');
    return t('reviews.visibleStatus');
  };

  return (
    <AdminLayout breadcrumb={t('reviews.breadcrumb')} loading={isLoading}>
      <DataTable headers={t('reviews.headers', { returnObjects: true }) as unknown as string[]}>
        {reviews.map((review) => (
          <tr key={review.id}>
            <td>{review.id}</td>
            <td>
              {review.movie?.name ?? (review.cinema?.name ? t('reviews.cinemaSuffix', { name: review.cinema.name }) : '—')}
            </td>
            <td>{'★'.repeat(review.rating)}</td>
            <td className="max-w-xs truncate">{review.comment}</td>
            <td>
              {statusLabel(review.status)}
              {!!review.reportCount && (
                <span className="ml-2 rounded bg-red-600/20 px-1.5 py-0.5 text-xs text-red-400">
                  🚩 {review.reportCount}
                </span>
              )}
            </td>
            <td className="flex gap-3">
              {review.status === 'VISIBLE' && (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleHide(review.id)}
                  >
                    {t('reviews.hideButton')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-amber-500 transition-colors hover:text-amber-400"
                    onClick={() => handleReject(review.id)}
                  >
                    {t('reviews.rejectButton')}
                  </button>
                </>
              )}
              {review.status !== 'VISIBLE' && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => handleRestore(review.id)}
                >
                  {t('reviews.restoreButton')}
                </button>
              )}
              <button
                type="button"
                className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                onClick={() => handleDelete(review.id)}
              >
                {t('reviews.deleteButton')}
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default AdminReviews;
