import { useCallback, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE, FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import type { Inventory, InventoryTransactionType } from '@/types/entities';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerCombos } from '../../hooks/useOwnerCombos';
import { useComboComponents } from '../../hooks/useComboComponents';
import { useOwnerInventory } from '../../hooks/useOwnerInventory';
import { useInventoryAlerts } from '../../hooks/useInventoryAlerts';
import { useInventoryHistory } from '../../hooks/useInventoryHistory';
import {
  useAdjustInventory,
  useCreateInventory,
  useDeductInventory,
  useDeleteInventory,
  useReceiveInventory,
} from '../../hooks/useInventoryMutations';
import { closeAddModal, closeHistory, closeStockAction, openAddModal, openHistory, openStockAction } from '../../store/ownerInventorySlice';
import type { InventoryFormValues, StockActionFormValues, StockActionMode } from '../../types/owner.types';

const STATUS_VARIANT: Record<Inventory['status'], 'success' | 'warning' | 'default'> = {
  IN_STOCK: 'success',
  LOW_STOCK: 'warning',
  OUT_OF_STOCK: 'default',
};

const STATUS_LABEL_KEY: Record<Inventory['status'], string> = {
  IN_STOCK: 'inventory.statusInStock',
  LOW_STOCK: 'inventory.statusLowStock',
  OUT_OF_STOCK: 'inventory.statusOutOfStock',
};

const STOCK_ACTION_TITLE_KEY: Record<StockActionMode, string> = {
  receive: 'inventory.stockAction.receiveTitle',
  adjust: 'inventory.stockAction.adjustTitle',
  deduct: 'inventory.stockAction.deductTitle',
};

const HISTORY_TYPE_LABEL_KEY: Record<InventoryTransactionType, string> = {
  RECEIVE: 'inventory.history.typeReceive',
  ADJUST: 'inventory.history.typeAdjust',
  DEDUCT: 'inventory.history.typeDeduct',
};

const emptyForm = (): InventoryFormValues => ({
  cinema_id: '',
  item: '',
  combo_id: '',
  quantity: '0',
  minimum_quantity: '0',
  unit: '',
});

interface ComboLinkFieldProps {
  cinemaId: string;
  value: string;
  onChange: (value: string) => void;
}

// Optionally links this record to a branch's own FOOD/BEVERAGE combo item, so a paid sale of
// that item (directly or bundled in a COMBO) auto-deducts this record.
function ComboLinkField({ cinemaId, value, onChange }: ComboLinkFieldProps) {
  const { t } = useTranslation('owner');
  const { data } = useComboComponents(cinemaId || undefined);
  const components = (data?.data ?? []).filter((combo) => combo.type !== 'COMBO');

  if (!cinemaId) {
    return <p className="mt-3 text-sm text-txt/60">{t('inventory.comboSelectCinemaFirst')}</p>;
  }

  return (
    <div className="mt-3">
      <Select
        label={t('inventory.comboLabel')}
        value={value}
        placeholder={t('inventory.comboPlaceholder')}
        options={components.map((component) => ({ label: component.name, value: component.id }))}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="mt-1.5 text-xs text-txt/50">{t('inventory.comboHint')}</p>
    </div>
  );
}

function InventoryList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const cinemaNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const { data: combosPage } = useOwnerCombos(1, FULL_LIST_FETCH_LIMIT);
  const comboNameById = useMemo(() => new Map((combosPage?.data ?? []).map((c) => [c.id, c.name])), [combosPage]);

  const { data, isLoading } = useOwnerInventory(page, DEFAULT_PAGE_SIZE);
  const items = data?.data ?? [];
  const { data: alerts } = useInventoryAlerts();

  const { showAddModal, stockAction, historyItemId } = useAppSelector((state) => state.ownerInventory);
  const { data: historyData } = useInventoryHistory(historyItemId, historyPage, DEFAULT_PAGE_SIZE);

  const createMutation = useCreateInventory();
  const deleteMutation = useDeleteInventory();
  const receiveMutation = useReceiveInventory();
  const adjustMutation = useAdjustInventory();
  const deductMutation = useDeductInventory();

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('inventory.deleteConfirm')))) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(t('inventory.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: InventoryFormValues, { resetForm }: FormikHelpers<InventoryFormValues>) => {
      try {
        await createMutation.mutateAsync(values);
        toast.success(t('inventory.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createMutation, dispatch, t],
  );

  const validateInventory = useCallback(
    (values: InventoryFormValues) => {
      const errors: Partial<Record<keyof InventoryFormValues, string>> = {};
      if (!values.cinema_id) errors.cinema_id = t('inventory.validation.cinemaRequired');
      if (!values.item.trim()) errors.item = t('inventory.validation.itemRequired');
      if (!values.unit.trim()) errors.unit = t('inventory.validation.unitRequired');
      if (values.quantity !== '' && Number(values.quantity) < 0) {
        errors.quantity = t('inventory.validation.quantityInvalid');
      }
      if (values.minimum_quantity !== '' && Number(values.minimum_quantity) < 0) {
        errors.minimum_quantity = t('inventory.validation.minQuantityInvalid');
      }
      return errors;
    },
    [t],
  );

  const closeStockActionModal = useCallback(() => dispatch(closeStockAction()), [dispatch]);

  const validateStockAction = useCallback(
    (values: StockActionFormValues) => {
      const errors: Partial<Record<keyof StockActionFormValues, string>> = {};
      const quantity = values.quantity === '' ? NaN : Number(values.quantity);
      if (stockAction?.mode === 'adjust') {
        if (values.quantity === '' || Number.isNaN(quantity) || quantity < 0) {
          errors.quantity = t('inventory.validation.adjustQuantityRequired');
        }
      } else if (values.quantity === '' || Number.isNaN(quantity) || quantity <= 0) {
        errors.quantity = t('inventory.validation.stockQuantityRequired');
      }
      return errors;
    },
    [stockAction, t],
  );

  const handleStockActionSubmit = useCallback(
    async (values: StockActionFormValues) => {
      if (!stockAction) return;
      const { id, mode } = stockAction;
      const quantity = Number(values.quantity);
      const reason = values.reason.trim() || undefined;
      try {
        if (mode === 'receive') await receiveMutation.mutateAsync({ id, quantity, reason });
        else if (mode === 'adjust') await adjustMutation.mutateAsync({ id, quantity, reason });
        else await deductMutation.mutateAsync({ id, quantity, reason });
        toast.success(t(`inventory.stockAction.${mode}Success`));
        dispatch(closeStockAction());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [stockAction, receiveMutation, adjustMutation, deductMutation, dispatch, t],
  );

  const stockActionPending =
    stockAction?.mode === 'receive'
      ? receiveMutation.isPending
      : stockAction?.mode === 'adjust'
        ? adjustMutation.isPending
        : deductMutation.isPending;

  const closeHistoryModal = useCallback(() => {
    dispatch(closeHistory());
    setHistoryPage(1);
  }, [dispatch]);

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

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('inventory.addTitle')}>
          <Formik<InventoryFormValues> initialValues={emptyForm()} validate={validateInventory} onSubmit={handleSubmit}>
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={Select}
                    label={t('inventory.cinemaLabel')}
                    name="cinema_id"
                    options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                    placeholder={t('inventory.cinemaPlaceholder')}
                    error={showErrors ? formik.errors.cinema_id : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('inventory.itemLabel')}
                    name="item"
                    className="mt-3"
                    error={showErrors ? formik.errors.item : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('inventory.unitLabel')}
                    name="unit"
                    className="mt-3"
                    error={showErrors ? formik.errors.unit : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('inventory.quantityLabel')}
                    name="quantity"
                    type="number"
                    className="mt-3"
                    error={showErrors ? formik.errors.quantity : undefined}
                  />
                  <Field
                    as={Input}
                    label={t('inventory.minQuantityLabel')}
                    name="minimum_quantity"
                    type="number"
                    className="mt-3"
                    error={showErrors ? formik.errors.minimum_quantity : undefined}
                  />
                  <ComboLinkField
                    cinemaId={formik.values.cinema_id}
                    value={formik.values.combo_id}
                    onChange={(value) => formik.setFieldValue('combo_id', value)}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createMutation.isPending}>
                      {t('inventory.submit')}
                    </Button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </Modal>
      )}

      {stockAction && (
        <Modal open onClose={closeStockActionModal} title={t(STOCK_ACTION_TITLE_KEY[stockAction.mode])}>
          <Formik<StockActionFormValues>
            initialValues={{ quantity: '', reason: '' }}
            validate={validateStockAction}
            onSubmit={handleStockActionSubmit}
          >
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={Input}
                    label={t('inventory.stockAction.quantityLabel')}
                    name="quantity"
                    type="number"
                    error={showErrors ? formik.errors.quantity : undefined}
                  />
                  {stockAction.mode === 'adjust' && (
                    <p className="mt-1.5 text-xs text-txt/50">{t('inventory.stockAction.adjustQuantityHint')}</p>
                  )}
                  <Field as={Input} label={t('inventory.stockAction.reasonLabel')} name="reason" className="mt-3" />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={stockActionPending}>
                      {t('inventory.stockAction.submit')}
                    </Button>
                  </div>
                </Form>
              );
            }}
          </Formik>
        </Modal>
      )}

      {historyItemId !== null && (
        <Modal open onClose={closeHistoryModal} title={t('inventory.history.title')} className="max-w-2xl">
          <DataTable
            headers={[
              t('inventory.history.headers.date'),
              t('inventory.history.headers.type'),
              t('inventory.history.headers.change'),
              t('inventory.history.headers.before'),
              t('inventory.history.headers.after'),
              t('inventory.history.headers.reason'),
            ]}
            emptyMessage={t('inventory.history.empty')}
          >
            {(historyData?.data ?? []).map((tx) => (
              <tr key={tx.id}>
                <td>{new Date(tx.createdAt).toLocaleString()}</td>
                <td>{t(HISTORY_TYPE_LABEL_KEY[tx.type])}</td>
                <td>
                  {tx.quantity_change > 0 ? '+' : ''}
                  {tx.quantity_change}
                </td>
                <td>{tx.quantity_before}</td>
                <td>{tx.quantity_after}</td>
                <td>{tx.reason || t('inventory.notLinked')}</td>
              </tr>
            ))}
          </DataTable>
          <Pagination page={historyPage} totalPages={historyData?.totalPages ?? 1} onPageChange={setHistoryPage} />
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('inventory.headers.id'),
            t('inventory.headers.cinema'),
            t('inventory.headers.item'),
            t('inventory.headers.combo'),
            t('inventory.headers.quantity'),
            t('inventory.headers.minQuantity'),
            t('inventory.headers.unit'),
            t('inventory.headers.status'),
            t('inventory.headers.actions'),
          ]}
        >
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{cinemaNameById.get(item.branch_id) || item.branch_id}</td>
              <td>{item.item}</td>
              <td>{item.combo_id ? comboNameById.get(item.combo_id) || item.combo_id : t('inventory.notLinked')}</td>
              <td>{item.quantity}</td>
              <td>{item.minimum_quantity}</td>
              <td>{item.unit}</td>
              <td>
                <Badge variant={STATUS_VARIANT[item.status]}>{t(STATUS_LABEL_KEY[item.status])}</Badge>
              </td>
              <td className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => dispatch(openStockAction({ id: item.id, mode: 'receive' }))}
                >
                  {t('inventory.receive')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => dispatch(openStockAction({ id: item.id, mode: 'adjust' }))}
                >
                  {t('inventory.adjust')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  onClick={() => dispatch(openStockAction({ id: item.id, mode: 'deduct' }))}
                >
                  {t('inventory.deduct')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-txt/70 transition-colors hover:text-txt"
                  onClick={() => dispatch(openHistory(item.id))}
                >
                  {t('inventory.historyButton')}
                </button>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(item.id)}
                >
                  {t('inventory.delete')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default InventoryList;
