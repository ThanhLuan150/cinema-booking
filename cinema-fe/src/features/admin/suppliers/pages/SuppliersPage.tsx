import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { usePermissions } from '@/hooks/usePermissions';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { Supplier, SupplierStatus } from '@/types/entities';
import { useDeleteSupplier, useSuppliers } from '../hooks/useSuppliers';
import { SupplierFormModal } from '../components/SupplierFormModal';

function SuppliersPage() {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  // A Branch Admin reads the catalogue (to pick a supplier) but only the Super Admin maintains it.
  const canManage = hasPermission('supplier.manage');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | SupplierStatus>('');
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useSuppliers(
    { search: search.trim() || undefined, status: statusFilter || undefined },
    { page, limit: DEFAULT_PAGE_SIZE },
  );
  const rows = data?.data ?? [];
  const deleteMutation = useDeleteSupplier();

  const openForm = (supplier: Supplier | null) => {
    setEditing(supplier);
    setOpen(true);
  };

  const remove = async (supplier: Supplier) => {
    if (!(await confirmDialog(t('suppliers.deleteConfirm', { name: supplier.name })))) return;
    try {
      await deleteMutation.mutateAsync(supplier.id);
      toast.success(t('suppliers.deleteSuccess'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('suppliers.breadcrumb')} loading={isLoading}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            id="supplier-search"
            label={t('suppliers.searchLabel')}
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder={t('suppliers.searchPlaceholder')}
          />
        </div>
        <div className="w-44">
          <Select
            id="supplier-status"
            label={t('suppliers.fields.status')}
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as '' | SupplierStatus);
            }}
            options={[
              { label: t('suppliers.allStatuses'), value: '' },
              { label: t('suppliers.status.ACTIVE'), value: 'ACTIVE' },
              { label: t('suppliers.status.INACTIVE'), value: 'INACTIVE' },
            ]}
          />
        </div>
        {canManage && (
          <Button type="button" variant="danger" onClick={() => openForm(null)}>
            {t('suppliers.addButton')}
          </Button>
        )}
      </div>

      <DataTable
        headers={[
          t('suppliers.headers.name'),
          t('suppliers.headers.code'),
          t('suppliers.headers.email'),
          t('suppliers.headers.phone'),
          t('suppliers.headers.address'),
          t('suppliers.headers.status'),
          t('suppliers.headers.actions'),
        ]}
      >
        {rows.map((supplier) => (
          <tr key={supplier.id}>
            <td className="font-medium">{supplier.name}</td>
            <td>{supplier.code}</td>
            <td>{supplier.email || '—'}</td>
            <td>{supplier.phone || '—'}</td>
            <td>{supplier.address || '—'}</td>
            <td>
              <Badge variant={supplier.status === 'ACTIVE' ? 'success' : 'outline'}>
                {t(`suppliers.status.${supplier.status}`)}
              </Badge>
            </td>
            <td className="flex flex-wrap gap-3">
              {canManage ? (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-accent hover:text-accent-hover"
                    onClick={() => openForm(supplier)}
                  >
                    {t('suppliers.edit')}
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 hover:text-red-400"
                    onClick={() => remove(supplier)}
                  >
                    {t('suppliers.delete')}
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
        <p className="mt-4 text-sm text-txt/60">{t('suppliers.empty')}</p>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />

      {open && <SupplierFormModal editing={editing} onClose={() => setOpen(false)} />}
    </AdminLayout>
  );
}

export default SuppliersPage;
