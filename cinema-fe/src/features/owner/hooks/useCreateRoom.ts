import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRoom } from '../api/owner.api';
import { roomsByCinemaQueryKey } from './useRoomsByCinema';

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; cinema_id: number }) => createRoom(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: roomsByCinemaQueryKey(payload.cinema_id) });
    },
  });
}
