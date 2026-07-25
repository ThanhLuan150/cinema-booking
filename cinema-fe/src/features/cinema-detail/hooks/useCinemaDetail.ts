import { useQuery } from '@tanstack/react-query';
import { getCinemaById } from '@/features/movies/api/movies.api';

export function useCinemaDetail(cinemaId: string | number | undefined) {
  return useQuery({
    queryKey: ['cinema', cinemaId],
    queryFn: () => getCinemaById(cinemaId as string | number),
    enabled: !!cinemaId,
  });
}
