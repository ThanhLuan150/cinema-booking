import { useQuery } from '@tanstack/react-query';
import { getPositions } from '../api/owner.api';

export const positionsQueryKey = ['positions'] as const;

export function usePositions() {
  return useQuery({
    queryKey: positionsQueryKey,
    queryFn: getPositions,
    staleTime: Infinity,
  });
}
