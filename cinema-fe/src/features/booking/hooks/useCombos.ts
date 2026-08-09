import { useQuery } from '@tanstack/react-query';
import { getCombos } from '../api/booking.api';

export function useCombos(branchId?: number | null) {
  return useQuery({
    queryKey: ['combos', branchId ?? null],
    queryFn: () => getCombos(branchId),
  });
}
