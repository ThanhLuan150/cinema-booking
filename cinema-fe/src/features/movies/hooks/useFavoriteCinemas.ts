import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyFavoriteCinemas } from '../api/movies.api';

export const favoriteCinemasQueryKey = ['myFavoriteCinemas'] as const;

export function useFavoriteCinemas() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: favoriteCinemasQueryKey,
    queryFn: getMyFavoriteCinemas,
    enabled: isAuthenticated,
  });
}
