import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerCombos } from '../api/owner.api';

export const ownerCombosQueryKey = ['ownerCombos'] as const;

export function useOwnerCombos(page: number, limit: number) {
  return useQuery({
    queryKey: [...ownerCombosQueryKey, page, limit],
    queryFn: () => getOwnerCombos(undefined, { page, limit }),
    placeholderData: keepPreviousData,
  });
}
