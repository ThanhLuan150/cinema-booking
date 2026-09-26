import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Supplier, SupplierStatus } from '@/types/entities';

export interface SupplierFilters {
  status?: SupplierStatus | '';
  search?: string;
}

export interface SupplierPayload {
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  status?: SupplierStatus;
}

export const getSuppliers = (params?: PaginationParams & SupplierFilters) =>
  apiClient.get<PaginatedResponse<Supplier>>('/suppliers', { params }).then((res) => res.data);

// Unpaginated, for pickers (the Purchase Order form only offers ACTIVE suppliers).
export const getAllSuppliers = (status?: SupplierStatus) =>
  apiClient
    .get<Supplier[]>('/suppliers/all', { params: status ? { status } : undefined })
    .then((res) => res.data);

export const createSupplier = (payload: SupplierPayload) =>
  apiClient.post<Supplier>('/suppliers', payload).then((res) => res.data);

export const updateSupplier = (id: number | string, payload: Partial<SupplierPayload>) =>
  apiClient.put<Supplier>(`/suppliers/${id}`, payload).then((res) => res.data);

export const deleteSupplier = (id: number | string) => apiClient.delete(`/suppliers/${id}`);
