import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getInventoryHistory } from '../api/owner.api';

export function useInventoryHistory(inventoryId: number | null, page: number, limit: number) {
  return useQuery({
    queryKey: ['inventoryHistory', inventoryId, page, limit],
    queryFn: () => getInventoryHistory(inventoryId as number, { page, limit }),
    enabled: inventoryId !== null,
    placeholderData: keepPreviousData,
  });
}
