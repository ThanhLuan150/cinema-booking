import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getCashierShifts } from '../api/cashierShift.api';
import type { CashierShiftListParams } from '../types/cashierShift.types';

export const cashierShiftsQueryKey = ['cashierShifts'] as const;

export function useCashierShifts(params: CashierShiftListParams) {
  return useQuery({
    queryKey: [...cashierShiftsQueryKey, params],
    queryFn: () => getCashierShifts(params),
    placeholderData: keepPreviousData,
  });
}
