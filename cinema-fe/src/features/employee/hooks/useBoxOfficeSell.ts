import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sellAtBoxOffice } from '../api/boxOffice.api';
import type { BoxOfficeSellPayload } from '../types/boxOffice.types';

export function useBoxOfficeSell() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: BoxOfficeSellPayload; idempotencyKey: string }) =>
      sellAtBoxOffice(payload, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeScheduleSeats'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
