import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  adjustInventory,
  createInventory,
  deleteInventory,
  importInventory,
  returnInventory,
  updateInventory,
  wasteInventory,
} from '../api/owner.api';
import { ownerInventoryQueryKey } from './useOwnerInventory';
import { inventoryAlertsQueryKey } from './useInventoryAlerts';
import { inventoryCategoriesQueryKey } from './useInventoryCategories';
import type { InventoryDetailValues, InventoryFormValues } from '../types/owner.types';

function invalidateInventory(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ownerInventoryQueryKey });
  queryClient.invalidateQueries({ queryKey: inventoryAlertsQueryKey });
  queryClient.invalidateQueries({ queryKey: inventoryCategoriesQueryKey });
  // The stock history modal reads its own key; a movement (or an edit) makes any open one stale.
  queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
}

// Form strings -> wire types. '' SKU / combo mean "none"; blank prices and minimums mean 0.
function toDetailPayload(values: InventoryDetailValues) {
  return {
    item: values.item.trim(),
    sku: values.sku.trim() ? values.sku.trim() : null,
    category: values.category.trim(),
    combo_id: values.combo_id ? Number(values.combo_id) : null,
    minimum_quantity: Number(values.minimum_quantity) || 0,
    unit: values.unit.trim(),
    cost_price: Number(values.cost_price) || 0,
    selling_price: Number(values.selling_price) || 0,
  };
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InventoryFormValues) =>
      createInventory({
        branch_id: Number(payload.cinema_id),
        quantity: Number(payload.quantity) || 0,
        ...toDetailPayload(payload),
      }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number | string; values: InventoryDetailValues }) =>
      updateInventory(id, toDetailPayload(values)),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useDeleteInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteInventory(id),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export interface StockActionInput {
  id: number | string;
  quantity: number;
  reason?: string;
}

function useStockMutation(action: (id: number | string, payload: { quantity: number; reason?: string }) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity, reason }: StockActionInput) => action(id, { quantity, reason }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

/** IMPORT — stock received from a supplier. */
export const useImportInventory = () => useStockMutation(importInventory);
/** RETURN — goods put back on the shelf. */
export const useReturnInventory = () => useStockMutation(returnInventory);
/** ADJUSTMENT — sets the absolute counted quantity (stocktake). */
export const useAdjustInventory = () => useStockMutation(adjustInventory);
/** WASTE — spoiled / expired / damaged stock written off. */
export const useWasteInventory = () => useStockMutation(wasteInventory);
