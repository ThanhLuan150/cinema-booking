import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getInventoryHistory } from '../api/owner.api';

export function useInventoryHistory(inventoryId: number | null, page: number, limit: number, type?: string) {
  return useQuery({
    queryKey: ['inventoryHistory', inventoryId, page, limit, type],
    queryFn: () => getInventoryHistory(inventoryId as number, { page, limit, type }),
    enabled: inventoryId !== null,
    placeholderData: keepPreviousData,
  });
}
