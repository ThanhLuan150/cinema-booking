import { useTranslation } from 'react-i18next';
import type { AdminReview } from '../types/adminReview.types';

export interface ListItemProps {
  review: AdminReview;
  onHide: (id: number) => void;
  onReject: (id: number) => void;
  onRestore: (id: number) => void;
  onDelete: (id: number) => void;
}

const statusLabel = (status: string, t: (key: string) => string) => {
  if (status === 'HIDDEN') return t('reviews.hiddenStatus');
  if (status === 'REJECTED') return t('reviews.rejectedStatus');
  return t('reviews.visibleStatus');
};

export const ListItem = ({ review, onHide, onReject, onRestore, onDelete }: ListItemProps) => {
  const { t } = useTranslation('admin');

  return (
    <tr>
      <td>{review.id}</td>
      <td>
        {review.movie?.name ?? (review.cinema?.name ? t('reviews.cinemaSuffix', { name: review.cinema.name }) : '—')}
      </td>
      <td>{'★'.repeat(review.rating)}</td>
      <td className="max-w-xs truncate">{review.comment}</td>
      <td>
        {statusLabel(review.status, t)}
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
              onClick={() => onHide(review.id)}
            >
              {t('reviews.hideButton')}
            </button>
            <button
              type="button"
              className="text-sm font-medium text-amber-500 transition-colors hover:text-amber-400"
              onClick={() => onReject(review.id)}
            >
              {t('reviews.rejectButton')}
            </button>
          </>
        )}
        {review.status !== 'VISIBLE' && (
          <button
            type="button"
            className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
            onClick={() => onRestore(review.id)}
          >
            {t('reviews.restoreButton')}
          </button>
        )}
        <button
          type="button"
          className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
          onClick={() => onDelete(review.id)}
        >
          {t('reviews.deleteButton')}
        </button>
      </td>
    </tr>
  );
};
