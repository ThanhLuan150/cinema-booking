import { useQuery } from '@tanstack/react-query';
import { getRoomsByCinema } from '../api/owner.api';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

export const roomsByCinemaQueryKey = (branchId: number | string | undefined) =>
  ['roomsByCinema', branchId === undefined ? undefined : String(branchId)] as const;

export function useRoomsByCinema(branchId: number | string | undefined) {
  return useQuery({
    queryKey: roomsByCinemaQueryKey(branchId),
    queryFn: () => getRoomsByCinema(branchId, { limit: FULL_LIST_FETCH_LIMIT }),
    enabled: !!branchId,
  });
}
