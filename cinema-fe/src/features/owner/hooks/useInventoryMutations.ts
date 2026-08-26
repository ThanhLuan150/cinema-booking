import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  adjustInventory,
  createInventory,
  deductInventory,
  deleteInventory,
  receiveInventory,
  updateInventory,
} from '../api/owner.api';
import { ownerInventoryQueryKey } from './useOwnerInventory';
import { inventoryAlertsQueryKey } from './useInventoryAlerts';
import type { InventoryFormValues } from '../types/owner.types';

function invalidateInventory(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ownerInventoryQueryKey });
  queryClient.invalidateQueries({ queryKey: inventoryAlertsQueryKey });
}

export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: InventoryFormValues) =>
      createInventory({
        branch_id: Number(payload.cinema_id),
        item: payload.item,
        combo_id: payload.combo_id ? Number(payload.combo_id) : null,
        quantity: Number(payload.quantity) || 0,
        minimum_quantity: Number(payload.minimum_quantity) || 0,
        unit: payload.unit,
      }),
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

interface StockActionInput {
  id: number | string;
  quantity: number;
  reason?: string;
}

export function useReceiveInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity, reason }: StockActionInput) => receiveInventory(id, { quantity, reason }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity, reason }: StockActionInput) => adjustInventory(id, { quantity, reason }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useDeductInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity, reason }: StockActionInput) => deductInventory(id, { quantity, reason }),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number | string } & Record<string, unknown>) => updateInventory(id, payload),
    onSuccess: () => invalidateInventory(queryClient),
  });
}
