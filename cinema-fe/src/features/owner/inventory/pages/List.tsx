import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useOwnerInventory } from '../../hooks/useOwnerInventory';
import { useInventoryAlerts } from '../../hooks/useInventoryAlerts';
import { closeAddModal, closeHistory, closeStockAction, openAddModal, openHistory, openStockAction } from '../../store/ownerInventorySlice';
import { AddInventoryModal } from '../components/AddInventoryModal';
import { StockActionModal } from '../components/StockActionModal';
import { HistoryModal } from '../components/HistoryModal';
import { InventoryTable } from '../components/InventoryTable';

function InventoryList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const cinemaNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const { data: combosPage } = useOwnerCombos(1, FULL_LIST_FETCH_LIMIT);
  const comboNameById = useMemo(() => new Map((combosPage?.data ?? []).map((c) => [c.id, c.name])), [combosPage]);

  const { data, isLoading } = useOwnerInventory(page, DEFAULT_PAGE_SIZE);
  const items = data?.data ?? [];
  const { data: alerts } = useInventoryAlerts();

  const { showAddModal, stockAction, historyItemId } = useAppSelector((state) => state.ownerInventory);

  return (
    <AdminLayout breadcrumb={t('inventory.breadcrumb')} loading={isLoading}>
      {alerts && alerts.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-600/40 bg-amber-600/10 px-4 py-3 text-sm text-amber-200">
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          {t('inventory.alertsBanner', { count: alerts.length })}
        </div>
      )}

      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('inventory.addButton')}
      </Button>

      {showAddModal && <AddInventoryModal cinemas={cinemas} onClose={() => dispatch(closeAddModal())} />}

      {stockAction && (
        <StockActionModal itemId={stockAction.id} mode={stockAction.mode} onClose={() => dispatch(closeStockAction())} />
      )}

      {historyItemId !== null && <HistoryModal itemId={historyItemId} onClose={() => dispatch(closeHistory())} />}

      <div className="mt-6">
        <InventoryTable
          items={items}
          cinemaNameById={cinemaNameById}
          comboNameById={comboNameById}
          onReceive={(id) => dispatch(openStockAction({ id, mode: 'receive' }))}
          onAdjust={(id) => dispatch(openStockAction({ id, mode: 'adjust' }))}
          onDeduct={(id) => dispatch(openStockAction({ id, mode: 'deduct' }))}
          onHistory={(id) => dispatch(openHistory(id))}
        />
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default InventoryList;
