import { SHOWTIME_BUFFER_MINUTES } from '../constants';
import type { Schedule } from '../types/adminSchedule.types';

function timeToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isSlotBlocked(
  timeBegin: string,
  timeEnd: string,
  existingSchedules: Pick<Schedule, 'time_begin' | 'time_end' | 'status'>[],
  bufferMinutes: number = SHOWTIME_BUFFER_MINUTES,
): boolean {
  const beginMinutes = timeToMinutes(timeBegin);
  const endMinutes = timeToMinutes(timeEnd);

  return existingSchedules.some((schedule) => {
    if (schedule.status === 'CANCELLED') return false;
    const otherBegin = timeToMinutes(schedule.time_begin);
    const otherEnd = timeToMinutes(schedule.time_end);
    const gap =
      otherEnd <= beginMinutes
        ? beginMinutes - otherEnd
        : endMinutes <= otherBegin
          ? otherBegin - endMinutes
          : 0;
    return gap < bufferMinutes;
  });
}
