import { useQuery } from '@tanstack/react-query';
import { getOwnerCombos } from '../api/owner.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

// Non-COMBO items (FOOD/BEVERAGE) available at a branch, for the "build a combo from its
// items" picker in the combo creation form.
export function useComboComponents(cinemaId: number | string | undefined) {
  return useQuery({
    queryKey: ['comboComponents', cinemaId],
    queryFn: () => getOwnerCombos(cinemaId, { limit: FULL_LIST_FETCH_LIMIT }),
    enabled: Boolean(cinemaId),
  });
}
