import { useQuery } from '@tanstack/react-query';
import { getSchedule } from '../api/booking.api';

export function useScheduleDetail(scheduleId: number | string | null) {
  return useQuery({
    queryKey: ['scheduleDetail', scheduleId],
    queryFn: () => getSchedule(scheduleId as number | string),
    enabled: !!scheduleId,
  });
}
