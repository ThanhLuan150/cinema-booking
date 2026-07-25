import type { ShowtimeSlot } from './types/adminSchedule.types';

// Fixed showtime slots (like MoMo/CGV) instead of a free time picker — admin schedules a movie
// into one of these standard slots for a given cinema/room/date.
export const SHOWTIME_SLOTS: ShowtimeSlot[] = [
  { time_begin: '09:00', time_end: '11:00' },
  { time_begin: '11:30', time_end: '13:30' },
  { time_begin: '14:00', time_end: '16:00' },
  { time_begin: '16:30', time_end: '18:30' },
  { time_begin: '19:00', time_end: '21:00' },
  { time_begin: '21:30', time_end: '23:30' },
];
