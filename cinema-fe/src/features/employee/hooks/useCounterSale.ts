import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createCounterSale } from '../api/employee.api';
import type { CounterSalePayload } from '../types/employee.types';

export function useCreateCounterSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CounterSalePayload) => createCounterSale(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employeeScheduleSeats'] }),
  });
}
