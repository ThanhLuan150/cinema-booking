import { useQuery } from '@tanstack/react-query';
import { getRoomSeats } from '../api/booking.api';

export function useRoomSeats(roomId: number | string | null | undefined) {
  return useQuery({
    queryKey: ['roomSeats', roomId],
    queryFn: () => getRoomSeats(roomId as number | string),
    enabled: !!roomId,
  });
}
