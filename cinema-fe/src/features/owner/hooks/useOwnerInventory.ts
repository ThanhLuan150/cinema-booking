import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerInventory } from '../api/owner.api';

export const ownerInventoryQueryKey = ['ownerInventory'] as const;

export interface OwnerInventoryFilters {
  status?: string;
  q?: string;
  category?: string;
}

export function useOwnerInventory(page: number, limit: number, filters: OwnerInventoryFilters = {}) {
  const { status, q, category } = filters;
  return useQuery({
    queryKey: [...ownerInventoryQueryKey, page, limit, status, q, category],
    queryFn: () => getOwnerInventory(undefined, { page, limit, status, q, category }),
    placeholderData: keepPreviousData,
  });
}
