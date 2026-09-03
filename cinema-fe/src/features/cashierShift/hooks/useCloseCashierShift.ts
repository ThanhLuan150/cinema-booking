import { useMutation, useQueryClient } from '@tanstack/react-query';
import { closeCashierShift } from '../api/cashierShift.api';
import { cashierShiftsQueryKey } from './useCashierShifts';
import { currentCashierShiftQueryKey } from './useCurrentCashierShift';
import type { CloseCashierShiftPayload } from '../types/cashierShift.types';

export function useCloseCashierShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: CloseCashierShiftPayload }) =>
      closeCashierShift(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: currentCashierShiftQueryKey });
      queryClient.invalidateQueries({ queryKey: cashierShiftsQueryKey });
    },
  });
}
