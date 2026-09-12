export interface ShowtimeSlot {
  time_begin: string;
  time_end: string;
}

export interface ScheduleFormValues {
  room_id: string;
  movie_date: string;
  time_begin: string;
  time_end: string;
  price: string;
}

export interface AddScheduleFormValues extends ScheduleFormValues {
  movie_id: string;
  cinema_id: string;
}

export interface RescheduleFormValues {
  movie_date: string;
  time_begin: string;
  time_end: string;
}

export interface Schedule {
  id: number;
  movie_id: number | string;
  room_id: number | string;
  cinema_id?: number;
  time_begin: string;
  time_end: string;
  movie_date: string;
  price: number;
  status?: 'ACTIVE' | 'CANCELLED';
}
