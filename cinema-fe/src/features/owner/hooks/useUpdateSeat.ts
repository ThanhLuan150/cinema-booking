import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSeat } from '../api/owner.api';

export function useUpdateSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number | string; status: 'ACTIVE' | 'DISABLED' }) =>
      updateSeat(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seatsByRoom'] });
    },
  });
}
