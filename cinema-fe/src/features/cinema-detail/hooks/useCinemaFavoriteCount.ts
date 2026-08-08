import { useQuery } from '@tanstack/react-query';
import { getCinemaFavoriteCount } from '@/features/movies/api/movies.api';

export function useCinemaFavoriteCount(branchId: string | number | undefined) {
  return useQuery({
    queryKey: ['cinemaFavoriteCount', branchId],
    queryFn: () => getCinemaFavoriteCount(branchId as string | number),
    enabled: !!branchId,
  });
}
