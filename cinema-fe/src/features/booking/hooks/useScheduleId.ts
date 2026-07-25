import { useQuery } from '@tanstack/react-query';
import { getScheduleId } from '../api/booking.api';

export function useScheduleId(params: { movie_id: string; movie_date: string; time_begin: string } | null) {
  return useQuery({
    queryKey: ['scheduleId', params],
    queryFn: () => getScheduleId(params as { movie_id: string; movie_date: string; time_begin: string }),
    enabled: !!(params?.movie_id && params?.movie_date && params?.time_begin),
  });
}
