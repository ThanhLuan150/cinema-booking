import { describe, expect, it } from 'vitest';
import { entrySeatPageUrl, formatCountdown, isActive, seatPageUrl, secondsLeft } from './waitlist';
import type { WaitlistEntry } from '../types/waitlist.types';

describe('waitlist helpers', () => {
  it('builds the seat page link the rest of the app uses', () => {
    expect(seatPageUrl(1, '2026-10-05', '19:30')).toBe('/BookSeat?movieId=1&day=2026-10-05&time=19%3A30');
  });

  it('has no seat page for an entry whose showtime is gone', () => {
    expect(entrySeatPageUrl({ movie: null, showtime: null } as WaitlistEntry)).toBeNull();
  });

  it('counts down whole seconds and never below zero', () => {
    const now = Date.parse('2026-10-05T10:00:00.000Z');
    expect(secondsLeft('2026-10-05T10:02:05.900Z', now)).toBe(125);
    expect(secondsLeft('2026-10-05T09:59:00.000Z', now)).toBe(0);
    expect(secondsLeft(null, now)).toBe(0);
    expect(formatCountdown(125)).toBe('2:05');
    expect(formatCountdown(0)).toBe('0:00');
  });

  it('treats only WAITING and NOTIFIED as active', () => {
    expect(['WAITING', 'NOTIFIED', 'BOOKED', 'EXPIRED', 'CANCELLED'].map((status) => isActive({ status } as WaitlistEntry))).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});
