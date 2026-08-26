import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMySummary } from '../api/membership.api';

export const myMembershipQueryKey = ['myMembership'] as const;

export function useMyMembership() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: myMembershipQueryKey,
    queryFn: getMySummary,
    enabled: isAuthenticated,
  });
}
