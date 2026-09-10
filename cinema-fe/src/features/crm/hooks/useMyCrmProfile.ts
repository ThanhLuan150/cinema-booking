import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyCrmProfile } from '../api/crm.api';

export const myCrmProfileQueryKey = ['myCrmProfile'] as const;

export function useMyCrmProfile() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: myCrmProfileQueryKey,
    queryFn: getMyCrmProfile,
    enabled: isAuthenticated,
  });
}
