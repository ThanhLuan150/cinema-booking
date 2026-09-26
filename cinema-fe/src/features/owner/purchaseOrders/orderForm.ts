import type { Inventory, PurchaseOrder, PurchaseOrderStatus } from '@/types/entities';
import type { BadgeVariant } from '@/components/ui/Badge';
import { formatDate } from '@/lib/format';
import type { PurchaseOrderPayload } from './api/purchaseOrders.api';

// A line while it is being edited: everything is a string because it comes from inputs.
export interface LineDraft {
  key: number; // local identity for React; never sent
  inventory_id: string;
  quantity: string;
  unit_cost: string; // '' = "use the product's cost price"
}

export interface OrderForm {
  branch_id: string;
  supplier_id: string;
  order_date: string;
  expected_date: string;
  note: string;
  lines: LineDraft[];
}

export type OrderFormErrors = Partial<
  Record<'branch_id' | 'supplier_id' | 'expected_date' | 'lines', string>
>;

export const STATUS_VARIANT: Record<PurchaseOrderStatus, BadgeVariant> = {
  DRAFT: 'outline',
  ORDERED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'default',
};

let nextKey = 1;
export const newLine = (overrides: Partial<LineDraft> = {}): LineDraft => ({
  key: nextKey++,
  inventory_id: '',
  quantity: '',
  unit_cost: '',
  ...overrides,
});

// Local calendar day as YYYY-MM-DD — what the date inputs (and the API) speak.
export function todayISO(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// The API returns instants; the form edits whole days. Both were saved from a date input as UTC
// midnight, so the UTC calendar day is the one to show back.
export const toDateInput = (value: string | null | undefined): string =>
  value ? value.slice(0, 10) : '';

// Renders a saved date-only value as that same calendar day in the viewer's locale. Building the
// Date from its Y/M/D parts (local) avoids `new Date('2026-10-10')` being shown as the 9th west of UTC.
export function displayDay(value: string | null | undefined, lang?: string): string {
  const day = toDateInput(value);
  if (!day) return '—';
  const [year, month, date] = day.split('-').map(Number);
  return formatDate(new Date(year, month - 1, date), lang);
}

export function emptyOrderForm(defaultBranchId = ''): OrderForm {
  return {
    branch_id: defaultBranchId,
    supplier_id: '',
    order_date: todayISO(),
    expected_date: '',
    note: '',
    lines: [newLine()],
  };
}

export function orderToForm(order: PurchaseOrder): OrderForm {
  return {
    branch_id: String(order.branch_id),
    supplier_id: String(order.supplier_id),
    order_date: toDateInput(order.order_date),
    expected_date: toDateInput(order.expected_date),
    note: order.note ?? '',
    lines: order.items.length
      ? order.items.map((line) =>
          newLine({
            inventory_id: String(line.inventory_id),
            quantity: String(line.quantity),
            unit_cost: String(line.unit_cost),
          }),
        )
      : [newLine()],
  };
}

const isPositive = (value: string) =>
  value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
const isNonNegative = (value: string) =>
  value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;

// A line the user never touched (no product, no quantity) is just an empty row, not an error.
const isBlank = (line: LineDraft) =>
  !line.inventory_id && !line.quantity.trim() && !line.unit_cost.trim();

// Returns keys into the i18n `purchaseOrders.validation` block; empty when the form can be saved.
export function validateOrderForm(form: OrderForm, { requireLines = false } = {}): OrderFormErrors {
  const errors: OrderFormErrors = {};
  if (!form.branch_id) errors.branch_id = 'branchRequired';
  if (!form.supplier_id) errors.supplier_id = 'supplierRequired';
  if (form.expected_date && form.order_date && form.expected_date < form.order_date) {
    errors.expected_date = 'expectedBeforeOrder';
  }

  const filled = form.lines.filter((line) => !isBlank(line));
  if (requireLines && filled.length === 0) errors.lines = 'linesRequired';
  else if (filled.some((line) => !line.inventory_id || !isPositive(line.quantity)))
    errors.lines = 'lineInvalid';
  else if (filled.some((line) => line.unit_cost.trim() !== '' && !isNonNegative(line.unit_cost)))
    errors.lines = 'costInvalid';
  else if (new Set(filled.map((line) => line.inventory_id)).size !== filled.length)
    errors.lines = 'duplicateLine';
  return errors;
}

export function toPayload(form: OrderForm): PurchaseOrderPayload {
  return {
    branch_id: Number(form.branch_id),
    supplier_id: Number(form.supplier_id),
    order_date: form.order_date || undefined,
    expected_date: form.expected_date || null,
    note: form.note.trim(),
    items: form.lines
      .filter((line) => !isBlank(line))
      .map((line) => ({
        inventory_id: Number(line.inventory_id),
        quantity: Number(line.quantity),
        ...(line.unit_cost.trim() !== '' ? { unit_cost: Number(line.unit_cost) } : {}),
      })),
  };
}

// Display-only preview: the server recomputes every figure and never trusts this one.
export function lineTotal(line: LineDraft, productById: Map<number, Inventory>): number {
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  const product = productById.get(Number(line.inventory_id));
  const unitCost =
    line.unit_cost.trim() !== '' ? Number(line.unit_cost) : (product?.cost_price ?? 0);
  return Number.isFinite(unitCost) ? quantity * unitCost : 0;
}

export const orderTotal = (lines: LineDraft[], productById: Map<number, Inventory>): number =>
  lines.reduce((sum, line) => sum + lineTotal(line, productById), 0);
