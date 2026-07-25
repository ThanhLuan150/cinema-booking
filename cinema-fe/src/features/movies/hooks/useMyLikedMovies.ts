import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyLikedMovies } from '../api/movies.api';

export const myLikedMoviesQueryKey = ['myLikedMovies'] as const;

export function useMyLikedMovies() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: myLikedMoviesQueryKey,
    queryFn: getMyLikedMovies,
    enabled: isAuthenticated,
  });
}
