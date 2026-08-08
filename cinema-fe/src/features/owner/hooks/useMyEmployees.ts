import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMyEmployees } from '../api/owner.api';

export const myEmployeesQueryKey = ['myEmployees'] as const;

export function useMyEmployees(cinemaId: number | string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: [...myEmployeesQueryKey, cinemaId, page, limit],
    queryFn: () => getMyEmployees(cinemaId as number | string, { page, limit }),
    placeholderData: keepPreviousData,
    enabled: cinemaId !== undefined && cinemaId !== '',
  });
}
