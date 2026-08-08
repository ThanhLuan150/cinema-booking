import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getActors } from '../api/actors.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const actorsQueryKey = ['actors'] as const;

export function useActors(page: number, limit: number) {
  return useQuery({
    queryKey: [...actorsQueryKey, page, limit],
    queryFn: () => getActors({ page, limit }),
    placeholderData: keepPreviousData,
  });
}

// Full, unpaginated catalog — used by pickers (e.g. the movie form) rather than the admin list page.
export function useActorsCatalog() {
  return useQuery({
    queryKey: [...actorsQueryKey, 'catalog'],
    queryFn: () => getActors({ limit: FULL_LIST_FETCH_LIMIT }),
  });
}
