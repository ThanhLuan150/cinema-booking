import { useQuery } from '@tanstack/react-query';
import { getCinemaFavoriteCount } from '@/features/movies/api/movies.api';

export function useCinemaFavoriteCount(cinemaId: string | number | undefined) {
  return useQuery({
    queryKey: ['cinemaFavoriteCount', cinemaId],
    queryFn: () => getCinemaFavoriteCount(cinemaId as string | number),
    enabled: !!cinemaId,
  });
}
