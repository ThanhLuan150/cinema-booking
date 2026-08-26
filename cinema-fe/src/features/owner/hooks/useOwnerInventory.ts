import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerInventory } from '../api/owner.api';

export const ownerInventoryQueryKey = ['ownerInventory'] as const;

export function useOwnerInventory(page: number, limit: number, status?: string) {
  return useQuery({
    queryKey: [...ownerInventoryQueryKey, page, limit, status],
    queryFn: () => getOwnerInventory(undefined, { page, limit, status }),
    placeholderData: keepPreviousData,
  });
}
