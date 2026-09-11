import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Integration, IntegrationType, Webhook, WebhookStatus } from '@/types/entities';
import {
  useCreateIntegration,
  useDeleteIntegration,
  useIntegrations,
  useUpdateIntegration,
} from '../hooks/useIntegrations';
import { useRetryWebhook, useWebhooks } from '../hooks/useWebhooks';

type Tab = 'integrations' | 'webhooks';

const INTEGRATION_TYPES: IntegrationType[] = [
  'PAYMENT_GATEWAY',
  'EMAIL_PROVIDER',
  'SMS_PROVIDER',
  'CLOUD_STORAGE',
  'ACCOUNTING_SYSTEM',
  'THIRD_PARTY_TICKETING',
];

const WEBHOOK_STATUSES: WebhookStatus[] = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'];

function statusBadge(status: string, t: (k: string) => string) {
  return status === 'ACTIVE' ? (
    <Badge variant="success">{t('integrations.status.ACTIVE')}</Badge>
  ) : (
    <Badge variant="outline">{t('integrations.status.INACTIVE')}</Badge>
  );
}

function webhookStatusBadge(status: WebhookStatus, t: (k: string) => string) {
  const variant = status === 'SUCCESS' ? 'success' : status === 'FAILED' ? 'warning' : 'outline';
  return <Badge variant={variant}>{t(`integrations.webhooks.status.${status}`)}</Badge>;
}

/* ------------------------------ Integrations tab ----------------------------- */

interface IntegrationForm {
  name: string;
  provider: string;
  type: IntegrationType;
  status: 'ACTIVE' | 'INACTIVE';
  secret_env_var: string;
  description: string;
}

const emptyIntegration: IntegrationForm = {
  name: '',
  provider: '',
  type: 'PAYMENT_GATEWAY',
  status: 'ACTIVE',
  secret_env_var: '',
  description: '',
};

function IntegrationsTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<IntegrationType | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');

  const { data, isLoading } = useIntegrations(
    { type: typeFilter || undefined, status: statusFilter || undefined },
    { page, limit: DEFAULT_PAGE_SIZE },
  );
  const rows = data?.data ?? [];

  const createMut = useCreateIntegration();
  const updateMut = useUpdateIntegration();
  const deleteMut = useDeleteIntegration();

  const [editing, setEditing] = useState<Integration | null>(null);
  const [form, setForm] = useState<IntegrationForm>(emptyIntegration);
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyIntegration);
    setOpen(true);
  };
  const openEdit = (i: Integration) => {
    setEditing(i);
    setForm({
      name: i.name,
      provider: i.provider,
      type: i.type,
      status: i.status,
      secret_env_var: i.secret_env_var ?? '',
      description: i.description ?? '',
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.provider.trim()) {
      toast.error(t('integrations.validation.required'));
      return;
    }
    const payload = {
      name: form.name.trim(),
      provider: form.provider.trim(),
      type: form.type,
      status: form.status,
      secret_env_var: form.secret_env_var.trim() || null,
      description: form.description.trim(),
    };
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, ...payload });
        toast.success(t('integrations.updateSuccess'));
      } else {
        await createMut.mutateAsync(payload);
        toast.success(t('integrations.createSuccess'));
      }
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  const remove = async (i: Integration) => {
    if (!(await confirmDialog(t('integrations.deleteConfirm', { name: i.name })))) return;
    try {
      await deleteMut.mutateAsync(i.id);
      toast.success(t('integrations.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-52">
          <Select
            id="integration-type-filter"
            label={t('integrations.filters.type')}
            value={typeFilter}
            onChange={(e) => {
              setPage(1);
              setTypeFilter(e.target.value as IntegrationType | '');
            }}
            options={[
              { label: t('integrations.filters.allTypes'), value: '' },
              ...INTEGRATION_TYPES.map((type) => ({ label: t(`integrations.types.${type}`), value: type })),
            ]}
          />
        </div>
        <div className="w-44">
          <Select
            id="integration-status-filter"
            label={t('integrations.filters.status')}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as '' | 'ACTIVE' | 'INACTIVE');
            }}
            options={[
              { label: t('integrations.filters.allStatuses'), value: '' },
              { label: t('integrations.status.ACTIVE'), value: 'ACTIVE' },
              { label: t('integrations.status.INACTIVE'), value: 'INACTIVE' },
            ]}
          />
        </div>
        {canManage && (
          <Button type="button" variant="danger" onClick={openCreate}>
            {t('integrations.addButton')}
          </Button>
        )}
      </div>

      <DataTable
        headers={[
          t('integrations.headers.name'),
          t('integrations.headers.provider'),
          t('integrations.headers.type'),
          t('integrations.headers.status'),
          t('integrations.headers.actions'),
        ]}
      >
        {rows.map((i) => (
          <tr key={i.id}>
            <td className="font-medium">{i.name}</td>
            <td>{i.provider}</td>
            <td>{t(`integrations.types.${i.type}`)}</td>
            <td>{statusBadge(i.status, t)}</td>
            <td className="flex flex-wrap gap-3">
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => openEdit(i)}
                  >
                    {t('integrations.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => remove(i)}
                  >
                    {t('integrations.delete')}
                  </button>
                </>
              ) : (
                <span className="text-sm text-txt/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {!isLoading && rows.length === 0 && <p className="mt-4 text-sm text-txt/60">{t('integrations.empty')}</p>}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {open && (
        <Modal
          open
          onClose={() => setOpen(false)}
          title={editing ? t('integrations.editTitle', { name: editing.name }) : t('integrations.addTitle')}
          className="max-w-lg"
        >
          <div className="space-y-3">
            <Input
              id="integration-name"
              label={t('integrations.fields.name')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              id="integration-provider"
              label={t('integrations.fields.provider')}
              value={form.provider}
              disabled={Boolean(editing)}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value.toUpperCase() }))}
              placeholder={t('integrations.fields.providerPlaceholder')}
            />
            <Select
              id="integration-type"
              label={t('integrations.fields.type')}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as IntegrationType }))}
              options={INTEGRATION_TYPES.map((type) => ({ label: t(`integrations.types.${type}`), value: type }))}
            />
            <Input
              id="integration-secret-env-var"
              label={t('integrations.fields.secretEnvVar')}
              value={form.secret_env_var}
              onChange={(e) => setForm((f) => ({ ...f, secret_env_var: e.target.value }))}
              placeholder={t('integrations.fields.secretEnvVarPlaceholder')}
            />
            <p className="text-xs text-txt/60">{t('integrations.fields.secretEnvVarHint')}</p>
            <Textarea
              id="integration-description"
              label={t('integrations.fields.description')}
              value={form.description}
              rows={2}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
            <Select
              id="integration-form-status"
              label={t('integrations.fields.status')}
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
              options={[
                { label: t('integrations.status.ACTIVE'), value: 'ACTIVE' },
                { label: t('integrations.status.INACTIVE'), value: 'INACTIVE' },
              ]}
            />
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                variant="danger"
                loading={createMut.isPending || updateMut.isPending}
                onClick={submit}
              >
                {t('integrations.save')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* -------------------------------- Webhooks tab -------------------------------- */

function WebhookDetailModal({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const { t } = useTranslation('admin');
  return (
    <Modal open onClose={onClose} title={t('integrations.webhooks.detailTitle', { id: webhook.id })} className="max-w-2xl">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.provider')}</div>
            <div className="font-medium">{webhook.provider}</div>
          </div>
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.event')}</div>
            <div className="font-medium">{webhook.event}</div>
          </div>
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.status')}</div>
            <div>{webhookStatusBadge(webhook.status, t)}</div>
          </div>
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.headers.attempts')}</div>
            <div className="font-medium">
              {webhook.attempts}/{webhook.max_attempts}
            </div>
          </div>
        </div>
        {webhook.last_error && (
          <div>
            <div className="text-txt/50">{t('integrations.webhooks.lastError')}</div>
            <div className="mt-1 rounded-lg bg-red-500/10 p-2 font-mono text-xs text-red-400">{webhook.last_error}</div>
          </div>
        )}
        <div>
          <div className="text-txt/50">{t('integrations.webhooks.payload')}</div>
          <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-surface-soft p-2 text-xs">
            {JSON.stringify(webhook.payload, null, 2)}
          </pre>
        </div>
      </div>
    </Modal>
  );
}

function WebhooksTab() {
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

/* ----------------------------------- Page ------------------------------------ */

function IntegrationsPage() {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('integration.manage');

  const [tab, setTab] = useState<Tab>('integrations');

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={
        tab === value
          ? 'border-b-2 border-accent px-4 py-2 text-sm font-semibold text-accent'
          : 'border-b-2 border-transparent px-4 py-2 text-sm font-medium text-txt/60 hover:text-txt'
      }
    >
      {label}
    </button>
  );

  return (
    <AdminLayout breadcrumb={t('integrations.breadcrumb')}>
      <div className="mb-6 flex gap-2 border-b border-border">
        {tabButton('integrations', t('integrations.tabs.integrations'))}
        {tabButton('webhooks', t('integrations.tabs.webhooks'))}
      </div>

      {tab === 'webhooks' ? <WebhooksTab /> : <IntegrationsTab canManage={canManage} />}
    </AdminLayout>
  );
}

export default IntegrationsPage;
