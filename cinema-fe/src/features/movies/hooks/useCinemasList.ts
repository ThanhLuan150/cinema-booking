import { useQuery } from '@tanstack/react-query';
import { getCinemasList } from '../api/movies.api';

export function useCinemasList() {
  return useQuery({
    queryKey: ['cinemas'],
    queryFn: getCinemasList,
  });
}
