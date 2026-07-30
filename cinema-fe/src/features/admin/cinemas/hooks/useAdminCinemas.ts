import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMyCinemas } from '@/features/owner/api/owner.api';

export const adminCinemasQueryKey = ['adminCinemas'] as const;

export function useAdminCinemas(page: number, limit: number) {
  return useQuery({
    queryKey: [...adminCinemasQueryKey, page, limit],
    queryFn: () => getMyCinemas({ page, limit }),
    placeholderData: keepPreviousData,
  });
}
