import { useQuery } from '@tanstack/react-query';
import { getCinemasList } from '../api/movies.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

// Feeds cinema-picker dropdowns (filters, forms), which need the whole catalog rather than one page.
export function useCinemasList() {
  return useQuery({
    queryKey: ['cinemas', 'full'],
    queryFn: () => getCinemasList({ limit: FULL_LIST_FETCH_LIMIT }),
  });
}
