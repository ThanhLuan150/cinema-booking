import { useAppSelector } from '@/hooks/redux';

export function useIsAuthenticated() {
  return useAppSelector((state) => !!state.auth.token);
}

export function useAuthToken() {
  return useAppSelector((state) => state.auth.token);
}

export function useAuthRole() {
  const role = useAppSelector((state) => state.auth.role);
  return role !== null ? Number(role) : null;
}
