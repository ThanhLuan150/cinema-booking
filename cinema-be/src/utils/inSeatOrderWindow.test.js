const {
  ORDER_CUTOFF_BEFORE_END_MINUTES,
  showtimeBounds,
  orderingWindow,
  checkOrderingWindow,
} = require('./inSeatOrderWindow');

const MINUTE = 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

// A showtime starting at `start` (a local Date), built from LOCAL getters for both halves — the
// same clock schedule.movie_date/time_begin are read back with.
function showtimeAt(start, durationMinutes = 120) {
  const end = new Date(start.getTime() + durationMinutes * MINUTE);
  return {
    movie_date: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    time_begin: `${pad(start.getHours())}:${pad(start.getMinutes())}`,
    time_end: `${pad(end.getHours())}:${pad(end.getMinutes())}`,
  };
}

describe('in-seat ordering window', () => {
  it('opens CHECKIN_BEFORE_SHOWTIME before the start and closes 15 minutes before the end', () => {
    const start = new Date(2026, 9, 3, 19, 30);
    const window = orderingWindow(showtimeAt(start), { opensBeforeMinutes: 45 });
    expect(window.startsAt).toBe(start.getTime());
    expect(window.opensAt).toBe(start.getTime() - 45 * MINUTE);
    expect(window.endsAt).toBe(start.getTime() + 120 * MINUTE);
    expect(window.closesAt).toBe(start.getTime() + (120 - ORDER_CUTOFF_BEFORE_END_MINUTES) * MINUTE);
  });

  it('rolls a showtime that runs past midnight onto the next day', () => {
    const start = new Date(2026, 9, 3, 23, 0);
    const bounds = showtimeBounds(showtimeAt(start, 130)); // 23:00 -> 01:10
    expect(bounds.endsAt - bounds.startsAt).toBe(130 * MINUTE);
  });

  it('falls back to a fixed duration when the end time is unreadable, and refuses an unreadable start', () => {
    const start = new Date(2026, 9, 3, 10, 0);
    const bounds = showtimeBounds({ ...showtimeAt(start), time_end: 'late' });
    expect(bounds.endsAt - bounds.startsAt).toBe(180 * MINUTE);
    expect(checkOrderingWindow({ movie_date: 'x', time_begin: 'y' }, start)).toEqual({
      error: 'IN_SEAT_ORDERING_CLOSED',
      window: null,
    });
  });

  // Every hour of the day, so a timezone/day-boundary mistake cannot hide behind one green run.
  it.each(Array.from({ length: 24 }, (_, hour) => hour))(
    'is closed before, open during and closed after the window for a showtime at %i:30 local time',
    (hour) => {
      const start = new Date(2026, 2, 10, hour, 30);
      const schedule = showtimeAt(start, 120);
      const at = (offsetMinutes) => new Date(start.getTime() + offsetMinutes * MINUTE);
      const opts = { opensBeforeMinutes: 60 };

      expect(checkOrderingWindow(schedule, at(-61), opts).error).toBe('IN_SEAT_ORDERING_NOT_OPEN');
      expect(checkOrderingWindow(schedule, at(-60), opts).error).toBeUndefined();
      expect(checkOrderingWindow(schedule, at(0), opts).error).toBeUndefined();
      expect(checkOrderingWindow(schedule, at(104), opts).error).toBeUndefined();
      expect(checkOrderingWindow(schedule, at(105), opts).error).toBe('IN_SEAT_ORDERING_CLOSED');
      expect(checkOrderingWindow(schedule, at(24 * 60), opts).error).toBe('IN_SEAT_ORDERING_CLOSED');
    },
  );

  it('defaults to opening 60 minutes before the start', () => {
    const start = new Date(2026, 9, 3, 12, 0);
    const schedule = showtimeAt(start);
    expect(checkOrderingWindow(schedule, new Date(start.getTime() - 61 * MINUTE)).error).toBe(
      'IN_SEAT_ORDERING_NOT_OPEN',
    );
    expect(checkOrderingWindow(schedule, new Date(start.getTime() - 59 * MINUTE)).error).toBeUndefined();
  });
});
