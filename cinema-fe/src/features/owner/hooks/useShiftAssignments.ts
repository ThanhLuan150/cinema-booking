import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getShiftAssignments } from '../api/owner.api';

export const shiftAssignmentsQueryKey = ['ownerShiftAssignments'] as const;

export interface ShiftAssignmentFilters {
  employeeId?: number | string;
  date?: string;
  status?: string;
}

export function useShiftAssignments(
  branchId: number | string | undefined,
  filters: ShiftAssignmentFilters,
  page: number,
  limit: number,
) {
  return useQuery({
    queryKey: [...shiftAssignmentsQueryKey, branchId, filters, page, limit],
    queryFn: () => getShiftAssignments(branchId as number | string, { ...filters, page, limit }),
    placeholderData: keepPreviousData,
    enabled: branchId !== undefined && branchId !== '',
  });
}
