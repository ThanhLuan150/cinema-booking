import { useQuery } from '@tanstack/react-query';
import { getRoomsByCinema } from '../api/owner.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const allRoomsQueryKey = ['allRooms'] as const;

export function useAllRooms() {
  return useQuery({
    queryKey: allRoomsQueryKey,
    queryFn: () => getRoomsByCinema(undefined, { limit: FULL_LIST_FETCH_LIMIT }),
  });
}
