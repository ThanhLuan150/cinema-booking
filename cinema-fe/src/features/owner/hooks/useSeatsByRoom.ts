import { useQuery } from '@tanstack/react-query';
import { getSeatsByRoom } from '../api/owner.api';

export const seatsByRoomQueryKey = (roomId: number | string | undefined) => ['seatsByRoom', roomId] as const;

export function useSeatsByRoom(roomId: number | string | undefined) {
  return useQuery({
    queryKey: seatsByRoomQueryKey(roomId),
    queryFn: () => getSeatsByRoom(roomId as number | string),
    enabled: !!roomId,
  });
}
