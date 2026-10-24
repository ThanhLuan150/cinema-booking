import { ROUTES } from '@/constants/routes';
import type { BadgeVariant } from '@/components/ui/Badge';
import type { WaitlistEntry, WaitlistStatus } from '../types/waitlist.types';

export const STATUS_VARIANT: Record<WaitlistStatus, BadgeVariant> = {
  WAITING: 'warning',
  NOTIFIED: 'accent',
  BOOKED: 'success',
  EXPIRED: 'default',
  CANCELLED: 'default',
};

export const isActive = (entry: Pick<WaitlistEntry, 'status'>) => entry.status === 'WAITING' || entry.status === 'NOTIFIED';

/** The seat page of a showtime — where an offer is booked. */
export function seatPageUrl(movieId: number | string, movieDate: string, timeBegin: string) {
  return `${ROUTES.bookSeat}?movieId=${encodeURIComponent(movieId)}&day=${encodeURIComponent(movieDate)}&time=${encodeURIComponent(timeBegin)}`;
}

export function entrySeatPageUrl(entry: WaitlistEntry) {
  if (!entry.movie || !entry.showtime) return null;
  return seatPageUrl(entry.movie.id, entry.showtime.movie_date, entry.showtime.time_begin);
}

/** Whole seconds left on an offer (0 once it has run out). */
export function secondsLeft(expiresAt: string | null, now = Date.now()) {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

export function formatCountdown(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
