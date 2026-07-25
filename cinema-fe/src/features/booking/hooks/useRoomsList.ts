import { useQuery } from '@tanstack/react-query';
import { getRoomsList } from '../api/booking.api';

export function useRoomsList(enabled = true) {
  return useQuery({
    queryKey: ['rooms'],
    queryFn: getRoomsList,
    enabled,
  });
}
