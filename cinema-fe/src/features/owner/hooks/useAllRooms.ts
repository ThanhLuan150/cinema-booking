import { useQuery } from '@tanstack/react-query';
import { getRoomsByCinema } from '../api/owner.api';

export const allRoomsQueryKey = ['allRooms'] as const;

export function useAllRooms() {
  return useQuery({
    queryKey: allRoomsQueryKey,
    queryFn: () => getRoomsByCinema(undefined),
  });
}
