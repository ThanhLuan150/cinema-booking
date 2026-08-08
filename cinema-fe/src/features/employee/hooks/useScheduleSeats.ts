import { useQuery } from '@tanstack/react-query';
import { getScheduleSeats } from '../api/employee.api';

export function useScheduleSeats(scheduleId: number | string | null) {
  return useQuery({
    queryKey: ['employeeScheduleSeats', scheduleId],
    queryFn: () => getScheduleSeats(scheduleId as number | string),
    enabled: !!scheduleId,
  });
}
