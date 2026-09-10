const {
  parseEventWindow,
  coveredDateStrs,
  intervalsOverlap,
  scheduleInterval,
  findShowtimeConflict,
  findEventConflict,
  localDateStr,
  MIN_DURATION_MINUTES,
  MAX_DURATION_HOURS,
} = require('./eventWindow');

// Local Date builder — tests stay timezone-independent because both sides of every comparison
// (event windows here, showtimes via scheduleInterval) are built from local wall-clock parts.
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0);

describe('parseEventWindow', () => {
  it('accepts a well-formed window and returns Date objects', () => {
    const out = parseEventWindow({ start_at: '2026-10-01T18:00:00Z', end_at: '2026-10-01T22:00:00Z' });
    expect(out.error).toBeUndefined();
    expect(out.start).toBeInstanceOf(Date);
    expect(out.end.getTime()).toBeGreaterThan(out.start.getTime());
  });

  it('rejects a non-date input', () => {
    expect(parseEventWindow({ start_at: 'nope', end_at: '2026-10-01T22:00:00Z' }).code).toBe('INVALID_EVENT_WINDOW');
  });

  it('rejects start >= end', () => {
    expect(parseEventWindow({ start_at: '2026-10-01T22:00:00Z', end_at: '2026-10-01T22:00:00Z' }).code).toBe(
      'INVALID_EVENT_WINDOW',
    );
  });

  it('rejects a window shorter than the minimum', () => {
    const start = new Date('2026-10-01T18:00:00Z');
    const end = new Date(start.getTime() + (MIN_DURATION_MINUTES - 1) * 60000);
    expect(parseEventWindow({ start_at: start, end_at: end }).code).toBe('EVENT_TOO_SHORT');
  });

  it('rejects a window longer than the maximum', () => {
    const start = new Date('2026-10-01T00:00:00Z');
    const end = new Date(start.getTime() + (MAX_DURATION_HOURS * 60 + 1) * 60000);
    expect(parseEventWindow({ start_at: start, end_at: end }).code).toBe('EVENT_TOO_LONG');
  });
});

describe('coveredDateStrs', () => {
  it('returns the single local day for a within-day window', () => {
    expect(coveredDateStrs(at(2026, 10, 1, 18), at(2026, 10, 1, 22))).toEqual(['2026-10-01']);
  });

  it('spans across midnight to the next local day', () => {
    expect(coveredDateStrs(at(2026, 10, 1, 23), at(2026, 10, 2, 1))).toEqual(['2026-10-01', '2026-10-02']);
  });
});

describe('intervalsOverlap', () => {
  it('is true for a genuine overlap', () => {
    expect(intervalsOverlap(at(2026, 10, 1, 18), at(2026, 10, 1, 22), at(2026, 10, 1, 20), at(2026, 10, 1, 23))).toBe(true);
  });

  it('is false when the intervals only touch at an endpoint', () => {
    expect(intervalsOverlap(at(2026, 10, 1, 18), at(2026, 10, 1, 20), at(2026, 10, 1, 20), at(2026, 10, 1, 22))).toBe(
      false,
    );
  });

  it('is false when fully disjoint', () => {
    expect(intervalsOverlap(at(2026, 10, 1, 10), at(2026, 10, 1, 12), at(2026, 10, 1, 18), at(2026, 10, 1, 22))).toBe(
      false,
    );
  });
});

describe('scheduleInterval', () => {
  it('builds a local [begin, end) from movie_date + time strings', () => {
    const iv = scheduleInterval({ movie_date: '2026-10-01', time_begin: '19:30', time_end: '21:45' });
    expect(iv.start).toEqual(at(2026, 10, 1, 19, 30));
    expect(iv.end).toEqual(at(2026, 10, 1, 21, 45));
  });

  it('pushes a past-midnight showtime end to the next day', () => {
    const iv = scheduleInterval({ movie_date: '2026-10-01', time_begin: '23:30', time_end: '01:00' });
    expect(iv.end.getTime()).toBeGreaterThan(iv.start.getTime());
    expect(localDateStr(iv.end)).toBe('2026-10-02');
  });
});

describe('findShowtimeConflict', () => {
  const start = at(2026, 10, 1, 18);
  const end = at(2026, 10, 1, 22);

  it('returns the overlapping showtime', () => {
    const schedules = [
      { id: 1, movie_date: '2026-10-01', time_begin: '12:00', time_end: '14:00', status: 'ACTIVE' },
      { id: 2, movie_date: '2026-10-01', time_begin: '21:00', time_end: '23:30', status: 'ACTIVE' },
    ];
    expect(findShowtimeConflict({ start, end, schedules }).id).toBe(2);
  });

  it('ignores a CANCELLED showtime that would otherwise overlap', () => {
    const schedules = [{ id: 9, movie_date: '2026-10-01', time_begin: '19:00', time_end: '21:00', status: 'CANCELLED' }];
    expect(findShowtimeConflict({ start, end, schedules })).toBeNull();
  });

  it('does not flag a showtime that merely abuts the window end', () => {
    const schedules = [{ id: 3, movie_date: '2026-10-01', time_begin: '22:00', time_end: '23:59', status: 'ACTIVE' }];
    expect(findShowtimeConflict({ start, end, schedules })).toBeNull();
  });

  it('returns null when there are no schedules', () => {
    expect(findShowtimeConflict({ start, end, schedules: [] })).toBeNull();
  });
});

describe('findEventConflict', () => {
  const start = at(2026, 10, 1, 18);
  const end = at(2026, 10, 1, 22);

  it('returns the overlapping event', () => {
    const events = [
      { id: 10, start_at: at(2026, 10, 1, 8), end_at: at(2026, 10, 1, 12) },
      { id: 11, start_at: at(2026, 10, 1, 20), end_at: at(2026, 10, 2, 0) },
    ];
    expect(findEventConflict({ start, end, events }).id).toBe(11);
  });

  it('skips the event named by excludeId (self re-check)', () => {
    const events = [{ id: 11, start_at: at(2026, 10, 1, 20), end_at: at(2026, 10, 1, 23) }];
    expect(findEventConflict({ start, end, events, excludeId: 11 })).toBeNull();
  });

  it('returns null when nothing overlaps', () => {
    const events = [{ id: 12, start_at: at(2026, 10, 2, 18), end_at: at(2026, 10, 2, 22) }];
    expect(findEventConflict({ start, end, events })).toBeNull();
  });
});
