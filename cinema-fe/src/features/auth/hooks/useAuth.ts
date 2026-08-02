import { useAppSelector } from '@/hooks/redux';

export function useIsAuthenticated() {
  return useAppSelector((state) => !!state.auth.accessToken);
}

export function useAuthToken() {
  return useAppSelector((state) => state.auth.accessToken);
}

export function useAuthRole() {
  const role = useAppSelector((state) => state.auth.role);
  return role !== null ? Number(role) : null;
}

export function useCurrentAccountId() {
  return useAppSelector((state) => state.auth.account?.id ?? null);
}
