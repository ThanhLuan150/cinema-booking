import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Webhook, WebhookStatus } from '@/types/entities';
import { WEBHOOK_STATUSES } from '../constants';
import { useRetryWebhook, useWebhooks } from '../hooks/useWebhooks';
import { webhookStatusBadge } from './StatusBadges';
import { WebhookDetailModal } from './WebhookDetailModal';

export function WebhooksTab() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [providerFilter, setProviderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<WebhookStatus | ''>('');
  const [detail, setDetail] = useState<Webhook | null>(null);

  const { data, isLoading } = useWebhooks(
    { provider: providerFilter.trim() || undefined, status: statusFilter || undefined },
    { page, limit: DEFAULT_PAGE_SIZE },
  );
  const rows = data?.data ?? [];
  const retryMut = useRetryWebhook();

  const retry = async (webhook: Webhook) => {
    try {
      await retryMut.mutateAsync(webhook.id);
      toast.success(t('integrations.webhooks.retrySuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Input
            id="webhook-provider-filter"
            label={t('integrations.webhooks.filters.provider')}
            value={providerFilter}
            onChange={(e) => {
              setPage(1);
              setProviderFilter(e.target.value);
            }}
            placeholder={t('integrations.webhooks.filters.providerPlaceholder')}
          />
        </div>
        <div className="w-44">
          <Select
            id="webhook-status-filter"
            label={t('integrations.filters.status')}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as WebhookStatus | '');
            }}
            options={[
              { label: t('integrations.filters.allStatuses'), value: '' },
              ...WEBHOOK_STATUSES.map((status) => ({ label: t(`integrations.webhooks.status.${status}`), value: status })),
            ]}
          />
        </div>
      </div>

      <DataTable
        headers={[
          t('integrations.webhooks.headers.provider'),
          t('integrations.webhooks.headers.event'),
          t('integrations.webhooks.headers.status'),
          t('integrations.webhooks.headers.attempts'),
          t('integrations.webhooks.headers.receivedAt'),
          t('integrations.webhooks.headers.actions'),
        ]}
      >
        {rows.map((w) => (
          <tr key={w.id}>
            <td className="font-medium">{w.provider}</td>
            <td>{w.event}</td>
            <td>{webhookStatusBadge(w.status, t)}</td>
            <td>
              {w.attempts}/{w.max_attempts}
            </td>
            <td>{w.createdAt ? new Date(w.createdAt).toLocaleString() : '—'}</td>
            <td className="flex flex-wrap gap-3">
              <button
                type="button"
                className="text-sm font-medium text-accent hover:text-accent-hover"
                onClick={() => setDetail(w)}
              >
                {t('integrations.webhooks.viewDetail')}
              </button>
              {w.status === 'FAILED' && (
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 hover:text-red-400"
                  onClick={() => retry(w)}
                  disabled={retryMut.isPending}
                >
                  {t('integrations.webhooks.retry')}
                </button>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {!isLoading && rows.length === 0 && <p className="mt-4 text-sm text-txt/60">{t('integrations.webhooks.empty')}</p>}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {detail && <WebhookDetailModal webhook={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
