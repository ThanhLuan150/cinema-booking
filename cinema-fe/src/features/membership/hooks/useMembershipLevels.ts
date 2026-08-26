import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMembershipLevels } from '../api/membership.api';

export const membershipLevelsQueryKey = ['membershipLevels'] as const;

export function useMembershipLevels() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: membershipLevelsQueryKey,
    queryFn: getMembershipLevels,
    enabled: isAuthenticated,
  });
}
