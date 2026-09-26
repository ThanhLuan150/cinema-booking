import type { Inventory, InventoryTransaction, InventoryTransactionType } from '@/types/entities';
import type { InventoryDetailValues, InventoryFormValues, StockActionMode } from '../types/owner.types';

export const emptyInventoryDetails = (): InventoryDetailValues => ({
  item: '',
  sku: '',
  category: '',
  combo_id: '',
  minimum_quantity: '0',
  unit: '',
  cost_price: '0',
  selling_price: '0',
});

export const emptyInventoryForm = (): InventoryFormValues => ({
  cinema_id: '',
  quantity: '0',
  ...emptyInventoryDetails(),
});

export const detailsFromItem = (item: Inventory): InventoryDetailValues => ({
  item: item.item,
  sku: item.sku ?? '',
  category: item.category ?? '',
  combo_id: item.combo_id ? String(item.combo_id) : '',
  minimum_quantity: String(item.minimum_quantity),
  unit: item.unit,
  cost_price: String(item.cost_price ?? 0),
  selling_price: String(item.selling_price ?? 0),
});

export const STATUS_VARIANT: Record<Inventory['status'], 'success' | 'warning' | 'default'> = {
  IN_STOCK: 'success',
  LOW_STOCK: 'warning',
  OUT_OF_STOCK: 'default',
};

export const STATUS_LABEL_KEY: Record<Inventory['status'], string> = {
  IN_STOCK: 'inventory.statusInStock',
  LOW_STOCK: 'inventory.statusLowStock',
  OUT_OF_STOCK: 'inventory.statusOutOfStock',
};

export const isLowStock = (status: Inventory['status']) => status === 'LOW_STOCK' || status === 'OUT_OF_STOCK';

export const HISTORY_TYPE_LABEL_KEY: Record<InventoryTransactionType, string> = {
  IMPORT: 'inventory.history.typeImport',
  SALE: 'inventory.history.typeSale',
  RETURN: 'inventory.history.typeReturn',
  ADJUSTMENT: 'inventory.history.typeAdjustment',
  WASTE: 'inventory.history.typeWaste',
};

export const HISTORY_TYPES = Object.keys(HISTORY_TYPE_LABEL_KEY) as InventoryTransactionType[];

// Rows written before the movement types were renamed (until `npm run migrate:inventory` runs):
// RECEIVE/ADJUST map one-to-one, and a DEDUCT is a sale when it came from a combo order.
export function historyTypeOf(tx: Pick<InventoryTransaction, 'type' | 'ref_type'>): InventoryTransactionType {
  switch (tx.type) {
    case 'RECEIVE':
      return 'IMPORT';
    case 'ADJUST':
      return 'ADJUSTMENT';
    case 'DEDUCT':
      return tx.ref_type === 'COMBO_ORDER' ? 'SALE' : 'WASTE';
    default:
      return tx.type;
  }
}

export const STOCK_ACTION_TITLE_KEY: Record<StockActionMode, string> = {
  import: 'inventory.stockAction.importTitle',
  return: 'inventory.stockAction.returnTitle',
  adjust: 'inventory.stockAction.adjustTitle',
  waste: 'inventory.stockAction.wasteTitle',
};
