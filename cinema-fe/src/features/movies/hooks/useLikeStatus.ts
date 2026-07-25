import { useQuery } from '@tanstack/react-query';
import { getLikeStatus } from '../api/movies.api';

export const likeStatusQueryKey = (movieId: string | number) => ['like', movieId] as const;

export function useLikeStatus(movieId: string | number) {
  return useQuery({
    queryKey: likeStatusQueryKey(movieId),
    queryFn: () => getLikeStatus(movieId),
    enabled: !!movieId,
  });
}
