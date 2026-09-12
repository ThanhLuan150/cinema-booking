import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Distributor } from '@/types/entities';
import { useDeleteDistributor, useDistributors } from '../hooks/useDistributors';
import { statusBadge } from './StatusBadge';
import { DistributorFormModal } from './DistributorFormModal';

export function DistributorsTab({ canManage }: { canManage: boolean }) {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ACTIVE' | 'INACTIVE'>('');

  const { data, isLoading } = useDistributors(
    { search: search.trim() || undefined, status: statusFilter || undefined },
    { page, limit: DEFAULT_PAGE_SIZE },
  );
  const rows = data?.data ?? [];

  const deleteMut = useDeleteDistributor();

  const [editing, setEditing] = useState<Distributor | null>(null);
  const [open, setOpen] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (d: Distributor) => {
    setEditing(d);
    setOpen(true);
  };

  const remove = async (d: Distributor) => {
    if (!(await confirmDialog(t('distribution.distributors.deleteConfirm', { name: d.name })))) return;
    try {
      await deleteMut.mutateAsync(d.id);
      toast.success(t('distribution.distributors.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            id="distributor-search"
            label={t('distribution.distributors.searchLabel')}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder={t('distribution.distributors.searchPlaceholder')}
          />
        </div>
        <div className="w-44">
          <Select
            id="distributor-status"
            label={t('distribution.filters.status')}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as '' | 'ACTIVE' | 'INACTIVE');
            }}
            options={[
              { label: t('distribution.filters.allStatuses'), value: '' },
              { label: t('distribution.status.ACTIVE'), value: 'ACTIVE' },
              { label: t('distribution.status.INACTIVE'), value: 'INACTIVE' },
            ]}
          />
        </div>
        {canManage && (
          <Button type="button" variant="danger" onClick={openCreate}>
            {t('distribution.distributors.addButton')}
          </Button>
        )}
      </div>

      <DataTable
        headers={[
          t('distribution.distributors.headers.name'),
          t('distribution.distributors.headers.code'),
          t('distribution.distributors.headers.email'),
          t('distribution.distributors.headers.phone'),
          t('distribution.distributors.headers.status'),
          t('distribution.distributors.headers.actions'),
        ]}
      >
        {rows.map((d) => (
          <tr key={d.id}>
            <td className="font-medium">{d.name}</td>
            <td>{d.code}</td>
            <td>{d.contact_email || '—'}</td>
            <td>{d.phone || '—'}</td>
            <td>{statusBadge(d.status, t)}</td>
            <td className="flex flex-wrap gap-3">
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => openEdit(d)}
                  >
                    {t('distribution.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => remove(d)}
                  >
                    {t('distribution.delete')}
                  </button>
                </>
              ) : (
                <span className="text-sm text-txt/40">—</span>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
      {!isLoading && rows.length === 0 && (
        <p className="mt-4 text-sm text-txt/60">{t('distribution.distributors.empty')}</p>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {open && <DistributorFormModal editing={editing} onClose={() => setOpen(false)} />}
    </>
  );
}
