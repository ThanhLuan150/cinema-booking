import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getDirectors } from '../api/directors.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const directorsQueryKey = ['directors'] as const;

export function useDirectors(page: number, limit: number) {
  return useQuery({
    queryKey: [...directorsQueryKey, page, limit],
    queryFn: () => getDirectors({ page, limit }),
    placeholderData: keepPreviousData,
  });
}

// Full, unpaginated catalog — used by pickers (e.g. the movie form) rather than the admin list page.
export function useDirectorsCatalog() {
  return useQuery({
    queryKey: [...directorsQueryKey, 'catalog'],
    queryFn: () => getDirectors({ limit: FULL_LIST_FETCH_LIMIT }),
  });
}
