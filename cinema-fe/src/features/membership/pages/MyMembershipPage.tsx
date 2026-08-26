import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { POINTS_TRANSACTION_TYPE_META } from '@/constants/pointsTransactionType';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyMembership } from '../hooks/useMyMembership';
import { useMyPointsHistory } from '../hooks/useMyPointsHistory';
import { useRedeemPoints } from '../hooks/useRedeemPoints';

function MyMembershipPage() {
  const { t } = useTranslation('membership');
  const [page, setPage] = useState(1);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemInput, setRedeemInput] = useState('');

  const { data: summary, isLoading: summaryLoading } = useMyMembership();
  const { data: history, isLoading: historyLoading } = useMyPointsHistory(page, DEFAULT_PAGE_SIZE);
  const redeemMutation = useRedeemPoints();

  const transactions = history?.data ?? [];
  // Progress toward the next tier's threshold, measured from zero lifetime points (we don't
  // know the current tier's own threshold from the summary, so this is "how far into the next
  // tier's requirement" rather than "how far between tiers" — simple and still informative).
  const progressPercent = summary?.next_level
    ? Math.min(100, Math.round(((summary.next_level.min_points - summary.points_to_next_level) / Math.max(summary.next_level.min_points, 1)) * 100))
    : 100;

  const handleRedeem = async () => {
    const points = Number(redeemInput);
    if (!Number.isInteger(points) || points <= 0) {
      toast.error(t('redeem.invalidAmount'));
      return;
    }
    if (!(await confirmDialog(t('redeem.confirm', { points })))) return;
    try {
      const result = await redeemMutation.mutateAsync({ points });
      toast.success(t('redeem.success', { value: result.redeemValue.toLocaleString() }));
      setShowRedeemModal(false);
      setRedeemInput('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AccountLayout title={t('pageTitle')}>
      {summaryLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {summary && (
        <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
                {t('currentTierLabel')}
              </span>
              <span className="mt-1 inline-block rounded-full bg-accent px-3 py-1 text-lg font-semibold text-white">
                {summary.membership_level_name}
              </span>
            </div>
            <div className="text-right">
              <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
                {t('pointsBalanceLabel')}
              </span>
              <span className="mt-1 block text-2xl font-bold text-white">
                {summary.points_balance.toLocaleString()}
              </span>
            </div>
            <Button type="button" onClick={() => setShowRedeemModal(true)} disabled={summary.points_balance <= 0}>
              {t('redeem.button')}
            </Button>
          </div>

          {summary.next_level ? (
            <div className="mt-6">
              <p className="text-xs text-txt/60">{t('progressToNext', { level: summary.next_level.name })}</p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-txt/60">
                {t('pointsToNext', { points: summary.points_to_next_level.toLocaleString(), level: summary.next_level.name })}
              </p>
            </div>
          ) : (
            <p className="mt-6 text-sm text-txt/60">{t('topTierReached')}</p>
          )}

          <p className="mt-4 text-xs text-txt/50">
            {t('lifetimePointsLabel', { points: summary.lifetime_points.toLocaleString() })}
          </p>
        </div>
      )}

      {showRedeemModal && (
        <Modal open onClose={() => setShowRedeemModal(false)} title={t('redeem.modalTitle')}>
          <Input
            id="redeem-points"
            type="number"
            min={1}
            label={t('redeem.inputLabel')}
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value)}
          />
          <div className="mt-6 flex justify-end">
            <Button type="button" onClick={handleRedeem} loading={redeemMutation.isPending}>
              {t('redeem.submit')}
            </Button>
          </div>
        </Modal>
      )}

      <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
        <h2 className="text-xl font-semibold">{t('history.title')}</h2>

        {historyLoading && <Spinner size="sm" className="mt-3" />}
        {!historyLoading && transactions.length === 0 && (
          <EmptyState title={t('history.empty')} icon="fa-solid fa-coins" />
        )}

        <div className="mt-3 flex flex-col gap-2">
          {transactions.map((tx) => {
            const meta = POINTS_TRANSACTION_TYPE_META[tx.type];
            return (
              <div
                key={tx.id}
                className="flex flex-col gap-1 rounded-xl border border-border bg-surface-soft p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span
                    className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', meta?.className)}
                  >
                    {t(`history.type.${meta?.key ?? 'adjust'}`)}
                  </span>
                  <p className="mt-1 text-sm text-txt/70">{tx.description}</p>
                  <p className="text-xs text-txt/50">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
                <span className={cn('font-semibold', tx.points >= 0 ? 'text-green-400' : 'text-red-400')}>
                  {tx.points >= 0 ? '+' : ''}
                  {tx.points.toLocaleString()}
                </span>
              </div>
            );
          })}
        </div>

        <Pagination page={page} totalPages={history?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AccountLayout>
  );
}

export default MyMembershipPage;
