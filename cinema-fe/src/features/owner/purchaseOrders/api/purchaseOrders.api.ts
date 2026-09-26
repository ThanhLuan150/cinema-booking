import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Inventory, PurchaseOrder, PurchaseOrderStatus } from '@/types/entities';

export interface PurchaseOrderFilters {
  status?: PurchaseOrderStatus | '';
  supplierId?: number | string;
  q?: string;
}

export interface PurchaseOrderLinePayload {
  inventory_id: number;
  quantity: number;
  // Omitted -> the server uses the product's cost_price.
  unit_cost?: number;
}

export interface PurchaseOrderPayload {
  branch_id: number;
  supplier_id: number;
  order_date?: string;
  expected_date?: string | null;
  note?: string;
  items: PurchaseOrderLinePayload[];
}

export interface ReceiveResult extends PurchaseOrder {
  movements: { inventoryId: number; quantity: number; before: number; after: number }[];
}

export const getPurchaseOrders = (params?: PaginationParams & PurchaseOrderFilters) =>
  apiClient
    .get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params })
    .then((res) => res.data);

export const createPurchaseOrder = (payload: PurchaseOrderPayload) =>
  apiClient.post<PurchaseOrder>('/purchase-orders', payload).then((res) => res.data);

// The branch of an order never changes, so it is not part of an update.
export const updatePurchaseOrder = (
  id: number | string,
  payload: Partial<Omit<PurchaseOrderPayload, 'branch_id'>>,
) => apiClient.put<PurchaseOrder>(`/purchase-orders/${id}`, payload).then((res) => res.data);

export const deletePurchaseOrder = (id: number | string) =>
  apiClient.delete(`/purchase-orders/${id}`);

export const confirmPurchaseOrder = (id: number | string) =>
  apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/confirm`).then((res) => res.data);

export const cancelPurchaseOrder = (id: number | string, reason?: string) =>
  apiClient
    .post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { reason })
    .then((res) => res.data);

export const receivePurchaseOrder = (id: number | string) =>
  apiClient.post<ReceiveResult>(`/purchase-orders/${id}/receive`).then((res) => res.data);

// The products an order for `branchId` can list (the API caps a page at 100).
export const getBranchProducts = (branchId: number | string) =>
  apiClient
    .get<PaginatedResponse<Inventory>>('/inventory', { params: { branchId, limit: 100 } })
    .then((res) => res.data.data);
