import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getOwnerHolidays } from '../api/owner.api';

export const ownerHolidaysQueryKey = ['ownerHolidays'] as const;

export function useOwnerHolidays(branchId: number | string | undefined, page: number, limit: number) {
  return useQuery({
    queryKey: [...ownerHolidaysQueryKey, branchId, page, limit],
    queryFn: () => getOwnerHolidays(branchId, { page, limit }),
    placeholderData: keepPreviousData,
  });
}
