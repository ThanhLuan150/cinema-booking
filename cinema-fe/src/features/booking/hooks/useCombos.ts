import { useQuery } from '@tanstack/react-query';
import { getCombos } from '../api/booking.api';

export function useCombos(cinemaId?: number | null) {
  return useQuery({
    queryKey: ['combos', cinemaId ?? null],
    queryFn: () => getCombos(cinemaId),
  });
}
