import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRoom } from '../api/owner.api';
import { roomsByCinemaQueryKey } from './useRoomsByCinema';

export function useUpdateRoom(cinemaId: number | string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: {
      id: number | string;
      name?: string;
      code?: string;
      type?: string;
      capacity?: number;
      status?: 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
    }) => updateRoom(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsByCinemaQueryKey(cinemaId) });
    },
  });
}
