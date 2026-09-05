import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '@/components/ui/DataTable';
import { cn } from '@/lib/cn';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyGiftCards } from '../hooks/useMyGiftCards';
import { useRedeemGiftCard } from '../hooks/useRedeemGiftCard';
import { useGiftCardHistory } from '../hooks/useGiftCardHistory';

const STATUS_BADGE: Record<string, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  USED: 'default',
  EXPIRED: 'warning',
  BLOCKED: 'warning',
};

function MyGiftCardsPage() {
  const { t } = useTranslation('giftCards');
  const [page, setPage] = useState(1);
  const [redeemCode, setRedeemCode] = useState('');
  const [historyCardId, setHistoryCardId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);

  const { data, isLoading } = useMyGiftCards(page, DEFAULT_PAGE_SIZE);
  const redeemMutation = useRedeemGiftCard();
  const { data: history, isLoading: historyLoading } = useGiftCardHistory(historyCardId, historyPage, DEFAULT_PAGE_SIZE);

  const cards = data?.data ?? [];

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code) return;
    try {
      await redeemMutation.mutateAsync(code);
      toast.success(t('redeem.success'));
      setRedeemCode('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AccountLayout title={t('pageTitle')}>
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 className="mb-3 text-base font-semibold text-white">{t('redeem.title')}</h2>
        <p className="mb-4 text-sm text-txt/60">{t('redeem.description')}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id="redeem-gift-card-code"
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder={t('redeem.placeholder')}
            className="flex-1"
          />
          <Button type="button" onClick={handleRedeem} loading={redeemMutation.isPending}>
            {t('redeem.button')}
          </Button>
        </div>
      </div>

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
                  onClick={() => {
                    setHistoryPage(1);
                    setHistoryCardId(card.id);
                  }}
                >
                  {t('list.viewHistory')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>

      {historyCardId !== null && (
        <Modal open onClose={() => setHistoryCardId(null)} title={t('history.title')}>
          <DataTable headers={[t('history.date'), t('history.type'), t('history.amount'), t('history.balanceAfter')]}>
            {(history?.data ?? []).map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{t(`historyType.${row.type}`)}</td>
                <td>{row.amount.toLocaleString()}</td>
                <td>{row.balance_after.toLocaleString()}</td>
              </tr>
            ))}
          </DataTable>
          {!historyLoading && (history?.data.length ?? 0) === 0 && (
            <EmptyState title={t('history.empty')} icon="fa-solid fa-clock-rotate-left" />
          )}
          <Pagination page={historyPage} totalPages={history?.totalPages ?? 1} onPageChange={setHistoryPage} />
        </Modal>
      )}
    </AccountLayout>
  );
}

export default MyGiftCardsPage;
