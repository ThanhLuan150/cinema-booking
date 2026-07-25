import { useQuery } from '@tanstack/react-query';
import { getRoomsByCinema } from '../api/owner.api';

export const roomsByCinemaQueryKey = (cinemaId: number | string | undefined) =>
  ['roomsByCinema', cinemaId === undefined ? undefined : String(cinemaId)] as const;

export function useRoomsByCinema(cinemaId: number | string | undefined) {
  return useQuery({
    queryKey: roomsByCinemaQueryKey(cinemaId),
    queryFn: () => getRoomsByCinema(cinemaId),
    enabled: !!cinemaId,
  });
}
