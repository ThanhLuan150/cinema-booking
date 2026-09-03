import { useQuery } from '@tanstack/react-query';
import { getCurrentCashierShift } from '../api/cashierShift.api';

export const currentCashierShiftQueryKey = ['cashierShifts', 'current'] as const;

// Polls a light interval so the "expected cash so far" figure keeps up with sales made from
// another screen (e.g. Box Office) while this page is left open.
export function useCurrentCashierShift(enabled: boolean) {
  return useQuery({
    queryKey: currentCashierShiftQueryKey,
    queryFn: () => getCurrentCashierShift(),
    enabled,
    refetchInterval: 15000,
  });
}
