import { useQuery } from '@tanstack/react-query';
import { getInventoryCategories } from '../api/owner.api';

export const inventoryCategoriesQueryKey = ['inventoryCategories'] as const;

export function useInventoryCategories() {
  return useQuery({
    queryKey: inventoryCategoriesQueryKey,
    queryFn: () => getInventoryCategories(),
  });
}
