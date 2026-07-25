import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateSeat } from '../api/owner.api';

export function useUpdateSeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isLocked }: { id: number | string; isLocked: boolean }) =>
      updateSeat(id, { is_locked: isLocked }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seatsByRoom'] });
    },
  });
}
