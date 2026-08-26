import { useQuery } from '@tanstack/react-query';
import { getMyCinemas } from '../api/owner.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const myCinemasQueryKey = ['myCinemas'] as const;

export function useMyCinemas(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: myCinemasQueryKey,
    queryFn: () => getMyCinemas({ limit: FULL_LIST_FETCH_LIMIT }),
    enabled: options?.enabled,
  });
}
