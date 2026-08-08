import { useQuery } from '@tanstack/react-query';
import { getCinemaById } from '@/features/movies/api/movies.api';

export function useCinemaDetail(branchId: string | number | undefined) {
  return useQuery({
    queryKey: ['cinema', branchId],
    queryFn: () => getCinemaById(branchId as string | number),
    enabled: !!branchId,
  });
}
