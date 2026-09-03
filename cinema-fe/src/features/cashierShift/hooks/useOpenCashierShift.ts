import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCashierShift } from '../api/cashierShift.api';
import { cashierShiftsQueryKey } from './useCashierShifts';
import { currentCashierShiftQueryKey } from './useCurrentCashierShift';
import type { OpenCashierShiftPayload } from '../types/cashierShift.types';

export function useOpenCashierShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OpenCashierShiftPayload) => openCashierShift(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: currentCashierShiftQueryKey });
      queryClient.invalidateQueries({ queryKey: cashierShiftsQueryKey });
    },
  });
}
