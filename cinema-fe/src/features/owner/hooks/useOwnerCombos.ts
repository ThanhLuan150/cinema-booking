import { useQuery } from '@tanstack/react-query';
import { getOwnerCombos } from '../api/owner.api';

export const ownerCombosQueryKey = ['ownerCombos'] as const;

export function useOwnerCombos() {
  return useQuery({
    queryKey: ownerCombosQueryKey,
    queryFn: () => getOwnerCombos(),
  });
}
