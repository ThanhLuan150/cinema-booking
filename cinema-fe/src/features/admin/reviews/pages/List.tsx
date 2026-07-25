import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAdminReviews } from '../hooks/useAdminReviews';
import { useDeleteReview, useHideReview } from '../hooks/useReviewModeration';

function AdminReviews() {
  const { t } = useTranslation('admin');
  const { data: reviews = [] } = useAdminReviews();
  const hideMutation = useHideReview();
  const deleteMutation = useDeleteReview();

  const handleHide = async (id: number) => {
    try {
      await hideMutation.mutateAsync(id);
      toast.success(t('reviews.hideSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const handleDelete = async (id: number) => {
    if (!(await confirmDialog(t('reviews.deleteConfirm')))) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t('reviews.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('reviews.breadcrumb')}>
      <DataTable headers={t('reviews.headers', { returnObjects: true }) as unknown as string[]}>
        {reviews.map((review) => (
          <tr key={review.id}>
            <td>{review.id}</td>
            <td>
              {review.movie?.name ?? (review.cinema?.name ? t('reviews.cinemaSuffix', { name: review.cinema.name }) : '—')}
            </td>
            <td>{'★'.repeat(review.rating)}</td>
            <td className="max-w-xs truncate">{review.comment}</td>
            <td>{review.hidden ? t('reviews.hiddenStatus') : t('reviews.visibleStatus')}</td>
            <td className="flex gap-3">
              {!review.hidden && (
                <button type="button" className="text-accent" onClick={() => handleHide(review.id)}>
                  {t('reviews.hideButton')}
                </button>
              )}
              <button type="button" className="text-red-500" onClick={() => handleDelete(review.id)}>
                {t('reviews.deleteButton')}
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
    </AdminLayout>
  );
}

export default AdminReviews;
