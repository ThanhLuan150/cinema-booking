import { useQuery } from '@tanstack/react-query';
import { getRoomsByCinema } from '../api/owner.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const roomsByCinemaQueryKey = (cinemaId: number | string | undefined) =>
  ['roomsByCinema', cinemaId === undefined ? undefined : String(cinemaId)] as const;

export function useRoomsByCinema(cinemaId: number | string | undefined) {
  return useQuery({
    queryKey: roomsByCinemaQueryKey(cinemaId),
    queryFn: () => getRoomsByCinema(cinemaId, { limit: FULL_LIST_FETCH_LIMIT }),
    enabled: !!cinemaId,
  });
}
