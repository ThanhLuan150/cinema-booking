import { useQuery } from '@tanstack/react-query';
import { getCashierShiftReconciliation } from '../api/cashierShift.api';

export function useCashierShiftReconciliation(id: number | null) {
  return useQuery({
    queryKey: ['cashierShifts', id, 'reconciliation'],
    queryFn: () => getCashierShiftReconciliation(id as number),
    enabled: id !== null,
  });
}
