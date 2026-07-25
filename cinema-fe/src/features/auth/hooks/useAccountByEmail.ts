import { useQuery } from '@tanstack/react-query';
import { getAccountByEmail } from '../api/auth.api';

export function useAccountByEmail(email: string | null) {
  return useQuery({
    queryKey: ['account', email],
    queryFn: () => getAccountByEmail(email as string),
    enabled: !!email,
    retry: false,
  });
}
