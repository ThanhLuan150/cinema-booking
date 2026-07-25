import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from './useAuth';
import { getCurrentUser } from '../api/auth.api';

export function useCurrentUser() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => getCurrentUser().then((res) => res.data),
    enabled: isAuthenticated,
    retry: false,
  });
}
