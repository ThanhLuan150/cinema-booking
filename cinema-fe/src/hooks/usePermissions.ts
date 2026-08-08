import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import { getMyPermissions } from '@/features/auth/api/auth.api';

export function usePermissions() {
  const isAuthenticated = useIsAuthenticated();
  const query = useQuery({
    queryKey: ['myPermissions'],
    queryFn: () => getMyPermissions().then((res) => res.data),
    enabled: isAuthenticated,
    retry: false,
  });

  const permissionSet = useMemo(() => new Set(query.data?.permissions ?? []), [query.data]);
  const hasPermission = (code: string) => permissionSet.has(code);

  return { ...query, hasPermission };
}
