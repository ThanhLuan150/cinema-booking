import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyGiftCards } from '../hooks/useMyGiftCards';
import { STATUS_BADGE } from '../constants';

export function GiftCardList({ onViewHistory }: { onViewHistory: (cardId: number) => void }) {
  const { t } = useTranslation('giftCards');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyGiftCards(page, DEFAULT_PAGE_SIZE);
  const cards = data?.data ?? [];

  return (
    <div className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-card">
      <h2 className="mb-4 text-xl font-semibold text-white">{t('list.title')}</h2>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      )}

      {!isLoading && cards.length === 0 && <EmptyState title={t('list.empty')} icon="fa-solid fa-gift" />}

      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface-soft p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-mono text-sm font-semibold text-white">{card.code}</p>
              <p className="mt-1 text-xs text-txt/50">
                {card.expires_at
                  ? t('list.expiresAt', { date: new Date(card.expires_at).toLocaleDateString() })
                  : t('list.noExpiry')}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={cn('text-lg font-bold', card.remaining_balance > 0 ? 'text-accent' : 'text-txt/50')}>
                  {card.remaining_balance.toLocaleString()}
                  {card.currency}
                </p>
                <p className="text-xs text-txt/45">
                  {t('list.ofInitial', { amount: card.initial_balance.toLocaleString(), currency: card.currency })}
                </p>
              </div>
              <Badge variant={STATUS_BADGE[card.status] ?? 'default'}>{t(`status.${card.status}`)}</Badge>
              <button
                type="button"
                className="text-sm font-medium text-accent underline transition-colors hover:text-accent-hover"
                onClick={() => onViewHistory(card.id)}
              >
                {t('list.viewHistory')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </div>
  );
}
