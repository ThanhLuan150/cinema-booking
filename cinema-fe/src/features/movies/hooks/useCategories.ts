import { useQuery } from '@tanstack/react-query';
import { getCategoriesList } from '../api/movies.api';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: getCategoriesList,
  });
}
