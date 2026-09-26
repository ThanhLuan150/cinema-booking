import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { DateInput } from '@/components/ui/DateInput';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { toast } from '@/features/notifications/toast';
import { useAllSuppliers } from '@/features/admin/suppliers/hooks/useSuppliers';
import { getApiErrorMessage } from '@/lib/apiError';
import { formatCurrency } from '@/lib/format';
import type { PurchaseOrder } from '@/types/entities';
import {
  useBranchProducts,
  useCreatePurchaseOrder,
  useUpdatePurchaseOrder,
} from '../hooks/usePurchaseOrders';
import {
  emptyOrderForm,
  lineTotal,
  newLine,
  orderToForm,
  orderTotal,
  toPayload,
  validateOrderForm,
  type LineDraft,
  type OrderForm,
  type OrderFormErrors,
} from '../orderForm';

interface PurchaseOrderFormModalProps {
  // null = a new order; a DRAFT order = edit it.
  editing: PurchaseOrder | null;
  cinemas: { id: number; name: string }[];
  onClose: () => void;
  onSaved?: (order: PurchaseOrder) => void;
}

export function PurchaseOrderFormModal({
  editing,
  cinemas,
  onClose,
  onSaved,
}: PurchaseOrderFormModalProps) {
  const { t, i18n } = useTranslation('owner');
  const [form, setForm] = useState<OrderForm>(() =>
    editing
      ? orderToForm(editing)
      : emptyOrderForm(cinemas.length === 1 ? String(cinemas[0].id) : ''),
  );
  const [showErrors, setShowErrors] = useState(false);

  const { data: suppliers = [] } = useAllSuppliers('ACTIVE');
  const { data: products = [] } = useBranchProducts(form.branch_id || undefined);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  // The draft's own supplier stays selectable even if it has since been deactivated, so the form
  // still shows it; saving with it is then rejected by the server with a clear message.
  const supplierOptions = useMemo(() => {
    const options = suppliers.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id }));
    if (editing?.supplier && !options.some((o) => o.value === editing.supplier_id)) {
      options.unshift({
        label: `${editing.supplier.name} (${editing.supplier.code})`,
        value: editing.supplier_id,
      });
    }
    return options;
  }, [suppliers, editing]);

  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const errors: OrderFormErrors = showErrors ? validateOrderForm(form) : {};
  const errorText = (key?: string) => (key ? t(`purchaseOrders.validation.${key}`) : undefined);

  const set = <K extends keyof OrderForm>(key: K, value: OrderForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setLine = (key: number, patch: Partial<LineDraft>) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    }));
  const removeLine = (key: number) =>
    setForm((f) => ({
      ...f,
      lines: f.lines.length > 1 ? f.lines.filter((line) => line.key !== key) : f.lines,
    }));

  // Stock is per branch: switching branch invalidates every product already chosen.
  const changeBranch = (branchId: string) =>
    setForm((f) => ({ ...f, branch_id: branchId, lines: [newLine()] }));

  const productOptionsFor = (line: LineDraft) =>
    products
      .filter(
        (p) =>
          String(p.id) === line.inventory_id ||
          !form.lines.some((l) => l.inventory_id === String(p.id)),
      )
      .map((p) => ({ label: `${p.item}${p.sku ? ` · ${p.sku}` : ''} (${p.unit})`, value: p.id }));

  const submit = async () => {
    setShowErrors(true);
    if (Object.keys(validateOrderForm(form)).length > 0) return;
    const payload = toPayload(form);
    try {
      let saved: PurchaseOrder;
      if (editing) {
        const { branch_id: _branch, ...rest } = payload;
        saved = await updateMutation.mutateAsync({ id: editing.id, ...rest });
        toast.success(t('purchaseOrders.updateSuccess'));
      } else {
        saved = await createMutation.mutateAsync(payload);
        toast.success(t('purchaseOrders.createSuccess'));
      }
      onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        editing
          ? t('purchaseOrders.editTitle', { code: editing.code })
          : t('purchaseOrders.addTitle')
      }
      className="!max-w-3xl"
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="po-branch"
            label={t('purchaseOrders.fields.branch')}
            placeholder={t('purchaseOrders.fields.branchPlaceholder')}
            value={form.branch_id}
            disabled={Boolean(editing)}
            options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
            onChange={(e) => changeBranch(e.target.value)}
            error={errorText(errors.branch_id)}
          />
          <Select
            id="po-supplier"
            label={t('purchaseOrders.fields.supplier')}
            placeholder={t('purchaseOrders.fields.supplierPlaceholder')}
            value={form.supplier_id}
            options={supplierOptions}
            onChange={(e) => set('supplier_id', e.target.value)}
            error={errorText(errors.supplier_id)}
          />
          <DateInput
            id="po-order-date"
            label={t('purchaseOrders.fields.orderDate')}
            value={form.order_date}
            onChange={(e) => set('order_date', e.target.value)}
          />
          <DateInput
            id="po-expected-date"
            label={t('purchaseOrders.fields.expectedDate')}
            value={form.expected_date}
            onChange={(e) => set('expected_date', e.target.value)}
            error={errorText(errors.expected_date)}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-txt/90">
            {t('purchaseOrders.linesTitle')}
          </h3>
          {!form.branch_id ? (
            <p className="text-sm text-txt/60">{t('purchaseOrders.pickBranchFirst')}</p>
          ) : (
            <div className="space-y-2">
              {form.lines.map((line) => (
                <div key={line.key} className="grid grid-cols-12 items-end gap-2">
                  <div className="col-span-12 sm:col-span-5">
                    <Select
                      aria-label={t('purchaseOrders.fields.product')}
                      placeholder={t('purchaseOrders.fields.productPlaceholder')}
                      value={line.inventory_id}
                      options={productOptionsFor(line)}
                      onChange={(e) => setLine(line.key, { inventory_id: e.target.value })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      aria-label={t('purchaseOrders.fields.quantity')}
                      placeholder={t('purchaseOrders.fields.quantity')}
                      value={line.quantity}
                      onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input
                      type="number"
                      aria-label={t('purchaseOrders.fields.unitCost')}
                      placeholder={
                        productById.get(Number(line.inventory_id))?.cost_price?.toString() ??
                        t('purchaseOrders.fields.unitCost')
                      }
                      value={line.unit_cost}
                      onChange={(e) => setLine(line.key, { unit_cost: e.target.value })}
                    />
                  </div>
                  <div className="col-span-3 pb-2.5 text-right text-sm text-txt/80 sm:col-span-2">
                    {formatCurrency(lineTotal(line, productById), i18n.language)}
                  </div>
                  <button
                    type="button"
                    aria-label={t('purchaseOrders.removeLine')}
                    disabled={form.lines.length === 1}
                    className="col-span-1 pb-2.5 text-red-500 hover:text-red-400 disabled:opacity-30"
                    onClick={() => removeLine(line.key)}
                  >
                    &times;
                  </button>
                </div>
              ))}
              {errors.lines && <p className="text-sm text-red-400">{errorText(errors.lines)}</p>}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={form.lines.length >= products.length}
                onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, newLine()] }))}
              >
                {t('purchaseOrders.addLine')}
              </Button>
            </div>
          )}
        </div>

        <Input
          id="po-note"
          label={t('purchaseOrders.fields.note')}
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
        />

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="text-sm text-txt/70">
            {t('purchaseOrders.totalLabel')}:{' '}
            <span className="text-base font-semibold text-txt">
              {formatCurrency(orderTotal(form.lines, productById), i18n.language)}
            </span>
          </div>
          <Button
            type="button"
            variant="danger"
            loading={createMutation.isPending || updateMutation.isPending}
            onClick={submit}
          >
            {t('purchaseOrders.saveDraft')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
