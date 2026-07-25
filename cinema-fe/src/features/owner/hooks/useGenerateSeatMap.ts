import { useMutation, useQueryClient } from '@tanstack/react-query';
import { generateSeatMap } from '../api/owner.api';
import { seatsByRoomQueryKey } from './useSeatsByRoom';
import type { GenerateSeatMapPayload } from '../types/owner.types';

export function useGenerateSeatMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, payload }: { roomId: number | string; payload: GenerateSeatMapPayload }) =>
      generateSeatMap(roomId, payload),
    onSuccess: (_data, { roomId }) => {
      queryClient.invalidateQueries({ queryKey: seatsByRoomQueryKey(roomId) });
    },
  });
}
