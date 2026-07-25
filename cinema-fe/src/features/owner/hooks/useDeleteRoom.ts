import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteRoom } from '../api/owner.api';

export function useDeleteRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomsByCinema'] });
    },
  });
}
