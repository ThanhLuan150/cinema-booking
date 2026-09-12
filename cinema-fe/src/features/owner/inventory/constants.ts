import type { Inventory, InventoryTransactionType } from '@/types/entities';
import type { InventoryFormValues, StockActionMode } from '../types/owner.types';

export const emptyInventoryForm = (): InventoryFormValues => ({
  cinema_id: '',
  item: '',
  combo_id: '',
  quantity: '0',
  minimum_quantity: '0',
  unit: '',
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

export const HISTORY_TYPE_LABEL_KEY: Record<InventoryTransactionType, string> = {
  RECEIVE: 'inventory.history.typeReceive',
  ADJUST: 'inventory.history.typeAdjust',
  DEDUCT: 'inventory.history.typeDeduct',
};

export const STOCK_ACTION_TITLE_KEY: Record<StockActionMode, string> = {
  receive: 'inventory.stockAction.receiveTitle',
  adjust: 'inventory.stockAction.adjustTitle',
  deduct: 'inventory.stockAction.deductTitle',
};
