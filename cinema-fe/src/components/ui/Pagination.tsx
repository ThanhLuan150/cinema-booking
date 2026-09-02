import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useAdminShell } from '@/contexts';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const { t } = useTranslation('common');
  const shell = useAdminShell();

  if (totalPages <= 1) return null;

  const bar = (
    <div
      className={cn(
        'flex items-center justify-center gap-4',
        shell ? 'border-t border-border bg-surface px-6 py-3 md:px-8' : 'mt-8',
      )}
    >
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

  if (!shell) return bar;
  return shell.footerEl ? createPortal(bar, shell.footerEl) : null;
}
