import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMySchedules } from '../api/employee.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const mySchedulesQueryKey = ['myEmployeeSchedules'] as const;

export function useMySchedules() {
  return useQuery({
    queryKey: mySchedulesQueryKey,
    queryFn: () => getMySchedules({ limit: FULL_LIST_FETCH_LIMIT }),
    placeholderData: keepPreviousData,
  });
}
