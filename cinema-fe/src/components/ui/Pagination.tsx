import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const { t } = useTranslation('common');

  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex items-center justify-center gap-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <i className="fa-solid fa-chevron-left text-xs" />
        {t('pagination.previous')}
      </Button>
      <span className="text-sm font-medium text-txt/70">
        {t('pagination.pageInfo', { page, totalPages })}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        {t('pagination.next')}
        <i className="fa-solid fa-chevron-right text-xs" />
      </Button>
    </div>
  );
}
