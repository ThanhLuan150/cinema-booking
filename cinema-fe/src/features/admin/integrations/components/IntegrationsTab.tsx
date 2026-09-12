import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Integration, IntegrationType } from '@/types/entities';
import { INTEGRATION_TYPES } from '../constants';
import { useDeleteIntegration, useIntegrations } from '../hooks/useIntegrations';
import { statusBadge } from './StatusBadges';
import { IntegrationFormModal } from './IntegrationFormModal';

export function IntegrationsTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<IntegrationType | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');

  const { data, isLoading } = useIntegrations(
    { type: typeFilter || undefined, status: statusFilter || undefined },
    { page, limit: DEFAULT_PAGE_SIZE },
  );
  const rows = data?.data ?? [];

  const deleteMut = useDeleteIntegration();

  const [editing, setEditing] = useState<Integration | null>(null);
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (i: Integration) => {
    setEditing(i);
    setOpen(true);
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

      {open && <IntegrationFormModal editing={editing} onClose={() => setOpen(false)} />}
    </>
  );
}
