import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatDate } from '@/lib/format';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { SubscriptionStatusBadge } from '@/features/membership/components/SubscriptionSection';
import { useAllSubscriptions, useRevokeSubscription } from '@/features/membership/hooks/useSubscriptions';
import type { Subscription, SubscriptionStatus } from '@/features/membership/types/membership.types';

const STATUSES: SubscriptionStatus[] = ['PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELLED'];

export function SubscriptionsTab() {
  const { t } = useTranslation('membership');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [accountId, setAccountId] = useState('');
  const { data } = useAllSubscriptions({
    page,
    limit: DEFAULT_PAGE_SIZE,
    status,
    accountId: /^\d+$/.test(accountId.trim()) ? accountId.trim() : undefined,
  });
  const revoke = useRevokeSubscription();

  const onRevoke = async (subscription: Subscription) => {
    if (!(await confirmDialog(t('admin.subscriptions.revokeConfirm', { code: subscription.code })))) return;
    try {
      await revoke.mutateAsync({ id: subscription.id });
      toast.success(t('admin.subscriptions.revoked'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select
            id="subscription-status"
            label={t('admin.subscriptions.status')}
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as SubscriptionStatus | '');
            }}
            options={[
              { label: t('admin.subscriptions.allStatuses'), value: '' },
              ...STATUSES.map((s) => ({ label: t(`subscription.status.${s}`), value: s })),
            ]}
          />
        </div>
        <div className="w-52">
          <Input
            id="subscription-account"
            label={t('admin.subscriptions.accountId')}
            inputMode="numeric"
            value={accountId}
            onChange={(e) => {
              setPage(1);
              setAccountId(e.target.value);
            }}
          />
        </div>
      </div>
      <DataTable
        headers={[
          t('admin.subscriptions.code'),
          t('admin.subscriptions.customer'),
          t('admin.subscriptions.plan'),
          t('admin.subscriptions.status'),
          t('admin.subscriptions.validity'),
          t('admin.subscriptions.used'),
          t('admin.subscriptions.actions'),
        ]}
        emptyMessage={t('admin.subscriptions.empty')}
      >
        {(data?.data ?? []).map((s) => (
          <tr key={s.id}>
            <td className="font-mono text-xs">{s.code}</td>
            <td>#{s.account_id}</td>
            <td>{s.plan.name}</td>
            <td>
              <SubscriptionStatusBadge status={s.status} />
            </td>
            <td className="whitespace-nowrap">{s.start_at && s.end_at ? `${formatDate(s.start_at)} – ${formatDate(s.end_at)}` : '—'}</td>
            <td>
              {s.tickets_used}/{s.plan.benefits.free_tickets}
            </td>
            <td>
              {(s.status === 'ACTIVE' || s.status === 'PENDING_PAYMENT') && (
                <Button type="button" size="sm" variant="danger" onClick={() => onRevoke(s)}>
                  {t('admin.subscriptions.revoke')}
                </Button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </>
  );
}
