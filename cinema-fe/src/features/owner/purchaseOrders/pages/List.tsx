import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { usePermissions } from '@/hooks/usePermissions';
import { useAllSuppliers } from '@/features/admin/suppliers/hooks/useSuppliers';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { formatCurrency } from '@/lib/format';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/types/entities';
import { PurchaseOrderDetailModal } from '../components/PurchaseOrderDetailModal';
import { PurchaseOrderFormModal } from '../components/PurchaseOrderFormModal';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { STATUS_VARIANT, displayDay } from '../orderForm';

const SEARCH_DEBOUNCE_MS = 300;
const STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED'];

function PurchaseOrdersList() {
  const { t, i18n } = useTranslation('owner');
  const { hasPermission } = usePermissions();
  // Three separate permissions: an Employee may be granted read + receive alone, a Branch Admin
  // holds all three. The buttons follow them; the API enforces the same rules regardless.
  const canManage = hasPermission('purchaseOrder.manage');
  const canReceive = hasPermission('purchaseOrder.receive');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [formOrder, setFormOrder] = useState<PurchaseOrder | null | undefined>(undefined); // undefined = closed

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Only a Branch Admin/Super Admin can list branches; a staffed Employee just gets their branch's rows.
  const { data: cinemasPage } = useMyCinemas({ enabled: hasPermission('branch.read') });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const cinemaNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);
  const { data: suppliers = [] } = useAllSuppliers(undefined, {
    enabled: hasPermission('supplier.read'),
  });

  const { data, isLoading } = usePurchaseOrders(
    { page, limit: DEFAULT_PAGE_SIZE },
    {
      status: (status as PurchaseOrderStatus) || undefined,
      supplierId: supplierId || undefined,
      q: debouncedSearch || undefined,
    },
  );
  const orders = data?.data ?? [];
  // The open order shows whichever copy is newer: the list's (a realtime update from someone else,
  // once it refetches) or the one a mutation just returned (the list is stale until it refetches,
  // and must not resurrect a button that was just used). Falls back to the last known copy when a
  // filter no longer includes the order.
  const listed = selected ? orders.find((o) => o.id === selected.id) : undefined;
  const current = selected && listed && listed.updatedAt >= selected.updatedAt ? listed : selected;

  return (
    <AdminLayout breadcrumb={t('purchaseOrders.breadcrumb')} loading={isLoading}>
      {canManage && (
        <Button type="button" variant="danger" onClick={() => setFormOrder(null)}>
          {t('purchaseOrders.addButton')}
        </Button>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input
          type="search"
          aria-label={t('purchaseOrders.filters.searchLabel')}
          placeholder={t('purchaseOrders.filters.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label={t('purchaseOrders.filters.statusLabel')}
          value={status}
          options={[
            { label: t('purchaseOrders.filters.allStatuses'), value: '' },
            ...STATUSES.map((value) => ({ label: t(`purchaseOrders.status.${value}`), value })),
          ]}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
        {hasPermission('supplier.read') && (
          <Select
            aria-label={t('purchaseOrders.filters.supplierLabel')}
            value={supplierId}
            options={[
              { label: t('purchaseOrders.filters.allSuppliers'), value: '' },
              ...suppliers.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id })),
            ]}
            onChange={(e) => {
              setSupplierId(e.target.value);
              setPage(1);
            }}
          />
        )}
      </div>

      <div className="mt-6">
        <DataTable
          headers={[
            t('purchaseOrders.headers.code'),
            t('purchaseOrders.headers.supplier'),
            t('purchaseOrders.headers.branch'),
            t('purchaseOrders.headers.orderDate'),
            t('purchaseOrders.headers.expectedDate'),
            t('purchaseOrders.headers.status'),
            t('purchaseOrders.headers.total'),
            t('purchaseOrders.headers.actions'),
          ]}
          emptyMessage={t('purchaseOrders.empty')}
        >
          {orders.map((order) => (
            <tr key={order.id}>
              <td className="font-medium">{order.code}</td>
              <td>{order.supplier?.name ?? `#${order.supplier_id}`}</td>
              <td>{cinemaNameById.get(order.branch_id) ?? `#${order.branch_id}`}</td>
              <td>{displayDay(order.order_date, i18n.language)}</td>
              <td>{displayDay(order.expected_date, i18n.language)}</td>
              <td>
                <Badge variant={STATUS_VARIANT[order.status]}>
                  {t(`purchaseOrders.status.${order.status}`)}
                </Badge>
              </td>
              <td>{formatCurrency(order.total_amount, i18n.language)}</td>
              <td>
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => setSelected(order)}
                >
                  {t('purchaseOrders.view')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>

      {current && (
        <PurchaseOrderDetailModal
          order={current}
          branchName={cinemaNameById.get(current.branch_id)}
          canManage={canManage}
          canReceive={canReceive}
          onEdit={(order) => {
            setSelected(null);
            setFormOrder(order);
          }}
          onChanged={setSelected}
          onClose={() => setSelected(null)}
        />
      )}
      {canManage && formOrder !== undefined && (
        <PurchaseOrderFormModal
          editing={formOrder}
          cinemas={cinemas}
          onSaved={setSelected}
          onClose={() => setFormOrder(undefined)}
        />
      )}
    </AdminLayout>
  );
}

export default PurchaseOrdersList;
