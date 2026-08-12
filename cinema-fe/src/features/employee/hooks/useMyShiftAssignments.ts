import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMyShiftAssignments } from '../api/employee.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const myShiftAssignmentsQueryKey = ['myShiftAssignments'] as const;

export function useMyShiftAssignments() {
  return useQuery({
    queryKey: myShiftAssignmentsQueryKey,
    queryFn: () => getMyShiftAssignments({ limit: FULL_LIST_FETCH_LIMIT }),
    placeholderData: keepPreviousData,
  });
}
