import { useQuery } from '@tanstack/react-query';
import { getTopCinemas } from '../api/movies.api';

export function useTopCinemas() {
  return useQuery({
    queryKey: ['topCinemas'],
    queryFn: getTopCinemas,
  });
}
