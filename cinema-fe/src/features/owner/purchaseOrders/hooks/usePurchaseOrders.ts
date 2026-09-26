import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
  type QueryClient,
} from '@tanstack/react-query';
import {
  cancelPurchaseOrder,
  confirmPurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  getBranchProducts,
  getPurchaseOrders,
  receivePurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderFilters,
  type PurchaseOrderPayload,
} from '../api/purchaseOrders.api';
import { ownerInventoryQueryKey } from '@/features/owner/hooks/useOwnerInventory';
import { inventoryAlertsQueryKey } from '@/features/owner/hooks/useInventoryAlerts';
import type { PaginationParams } from '@/types/pagination';

export const purchaseOrdersQueryKey = ['purchaseOrders'] as const;
export const branchProductsQueryKey = ['purchaseOrderProducts'] as const;

export function usePurchaseOrders(
  pagination: PaginationParams,
  filters: PurchaseOrderFilters = {},
) {
  return useQuery({
    queryKey: [...purchaseOrdersQueryKey, pagination, filters],
    queryFn: () => getPurchaseOrders({ ...pagination, ...filters }),
    placeholderData: keepPreviousData,
  });
}

// Products a Purchase Order for `branchId` may contain. Disabled until a branch is chosen.
export function useBranchProducts(branchId: number | string | undefined) {
  return useQuery({
    queryKey: [...branchProductsQueryKey, branchId],
    queryFn: () => getBranchProducts(branchId as number | string),
    enabled: branchId !== undefined && branchId !== '',
  });
}

function invalidateOrders(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: purchaseOrdersQueryKey });
}

// Receiving is the one action that changes stock, so the inventory views (and their low-stock
// alerts and history) are refreshed too rather than waiting for the realtime event.
function invalidateOrdersAndStock(queryClient: QueryClient) {
  invalidateOrders(queryClient);
  queryClient.invalidateQueries({ queryKey: ownerInventoryQueryKey });
  queryClient.invalidateQueries({ queryKey: inventoryAlertsQueryKey });
  queryClient.invalidateQueries({ queryKey: ['inventoryHistory'] });
  queryClient.invalidateQueries({ queryKey: branchProductsQueryKey });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PurchaseOrderPayload) => createPurchaseOrder(payload),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: Partial<Omit<PurchaseOrderPayload, 'branch_id'>> & { id: number | string }) =>
      updatePurchaseOrder(id, payload),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deletePurchaseOrder(id),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useConfirmPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => confirmPurchaseOrder(id),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number | string; reason?: string }) =>
      cancelPurchaseOrder(id, reason),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => receivePurchaseOrder(id),
    onSuccess: () => invalidateOrdersAndStock(queryClient),
  });
}
