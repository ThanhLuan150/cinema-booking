import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { usePermissions } from '@/hooks/usePermissions';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useOwnerInventory } from '../../hooks/useOwnerInventory';
import { useInventoryAlerts } from '../../hooks/useInventoryAlerts';
import { useInventoryCategories } from '../../hooks/useInventoryCategories';
import {
  closeAddModal,
  closeEditModal,
  closeHistory,
  closeStockAction,
  openAddModal,
  openEditModal,
  openHistory,
  openStockAction,
} from '../../store/ownerInventorySlice';
import { AddInventoryModal } from '../components/AddInventoryModal';
import { EditInventoryModal } from '../components/EditInventoryModal';
import { StockActionModal } from '../components/StockActionModal';
import { HistoryModal } from '../components/HistoryModal';
import { InventoryTable } from '../components/InventoryTable';
import { STATUS_LABEL_KEY } from '../constants';

const SEARCH_DEBOUNCE_MS = 300;

function InventoryList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  // Typing shouldn't fire a request per keystroke; a new search also starts back on page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  // Only a Branch Admin/Super Admin can list branches (branch.read); a staffed Employee reading
  // stock (inventory.view) would just get a 403, and the backend already limits their rows to
  // the branch they work at.
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('inventory.manage');
  const { data: cinemasPage } = useMyCinemas({ enabled: hasPermission('branch.read') });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const cinemaNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const { data: combosPage } = useOwnerCombos(1, FULL_LIST_FETCH_LIMIT);
  const comboNameById = useMemo(() => new Map((combosPage?.data ?? []).map((c) => [c.id, c.name])), [combosPage]);

  const { data, isLoading } = useOwnerInventory(page, DEFAULT_PAGE_SIZE, {
    status: status || undefined,
    q: debouncedSearch || undefined,
    category: category || undefined,
  });
  const items = data?.data ?? [];
  const { data: alerts } = useInventoryAlerts();
  const { data: categories } = useInventoryCategories();

  const { showAddModal, editItemId, stockAction, historyItemId } = useAppSelector((state) => state.ownerInventory);
  const editItem = editItemId === null ? undefined : items.find((item) => item.id === editItemId);

  const statusOptions = [
    { label: t('inventory.filters.allStatuses'), value: '' },
    ...(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] as const).map((value) => ({ label: t(STATUS_LABEL_KEY[value]), value })),
  ];
  const categoryOptions = [
    { label: t('inventory.filters.allCategories'), value: '' },
    ...(categories ?? []).map((value) => ({ label: value, value })),
  ];

  return (
    <AdminLayout breadcrumb={t('inventory.breadcrumb')} loading={isLoading}>
      {alerts && alerts.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-600/40 bg-amber-600/10 px-4 py-3 text-sm text-amber-200">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          {t('inventory.alertsBanner', { count: alerts.length })}
        </div>
      )}

      {canManage && (
        <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
          {t('inventory.addButton')}
        </Button>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Input
          type="search"
          aria-label={t('inventory.filters.searchLabel')}
          placeholder={t('inventory.filters.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label={t('inventory.filters.statusLabel')}
          value={status}
          options={statusOptions}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
        <Select
          aria-label={t('inventory.filters.categoryLabel')}
          value={category}
          options={categoryOptions}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {canManage && showAddModal && <AddInventoryModal cinemas={cinemas} onClose={() => dispatch(closeAddModal())} />}

      {canManage && editItem && <EditInventoryModal item={editItem} onClose={() => dispatch(closeEditModal())} />}

      {canManage && stockAction && (
        <StockActionModal itemId={stockAction.id} mode={stockAction.mode} onClose={() => dispatch(closeStockAction())} />
      )}

      {historyItemId !== null && <HistoryModal itemId={historyItemId} onClose={() => dispatch(closeHistory())} />}

      <div className="mt-6">
        <InventoryTable
          items={items}
          cinemaNameById={cinemaNameById}
          comboNameById={comboNameById}
          canManage={canManage}
          onImport={(id) => dispatch(openStockAction({ id, mode: 'import' }))}
          onReturn={(id) => dispatch(openStockAction({ id, mode: 'return' }))}
          onAdjust={(id) => dispatch(openStockAction({ id, mode: 'adjust' }))}
          onWaste={(id) => dispatch(openStockAction({ id, mode: 'waste' }))}
          onEdit={(id) => dispatch(openEditModal(id))}
          onHistory={(id) => dispatch(openHistory(id))}
        />
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default InventoryList;
