const { checkReleaseWindow, evaluateShowtimeAgainstReleases } = require('./releaseWindow');

describe('checkReleaseWindow — boundary dates', () => {
  it('allows a showtime that starts exactly at 00:00 on the release date', () => {
    expect(
      checkReleaseWindow({ movieDate: '2026-03-10', timeBegin: '00:00', releaseDate: '2026-03-10' }),
    ).toEqual({ ok: true });
  });

  it('allows a showtime later on the release date itself', () => {
    expect(
      checkReleaseWindow({ movieDate: '2026-03-10', timeBegin: '23:59', releaseDate: '2026-03-10' }),
    ).toEqual({ ok: true });
  });

  it('rejects a showtime one day before the release date', () => {
    expect(
      checkReleaseWindow({ movieDate: '2026-03-09', timeBegin: '23:59', releaseDate: '2026-03-10' }),
    ).toEqual({ ok: false, code: 'BEFORE_RELEASE_DATE' });
  });

  it('allows a showtime at 23:59 on the end date (end date is inclusive of the whole day)', () => {
    expect(
      checkReleaseWindow({
        movieDate: '2026-06-01',
        timeBegin: '23:59',
        releaseDate: '2026-03-10',
        endDate: '2026-06-01',
      }),
    ).toEqual({ ok: true });
  });

  it('allows a showtime at 00:00 on the end date', () => {
    expect(
      checkReleaseWindow({
        movieDate: '2026-06-01',
        timeBegin: '00:00',
        releaseDate: '2026-03-10',
        endDate: '2026-06-01',
      }),
    ).toEqual({ ok: true });
  });

  it('rejects a showtime on the day after the end date', () => {
    expect(
      checkReleaseWindow({
        movieDate: '2026-06-02',
        timeBegin: '00:00',
        releaseDate: '2026-03-10',
        endDate: '2026-06-01',
      }),
    ).toEqual({ ok: false, code: 'AFTER_RELEASE_END' });
  });

  it('treats a null / empty end date as an open-ended run', () => {
    expect(
      checkReleaseWindow({ movieDate: '2030-01-01', timeBegin: '12:00', releaseDate: '2026-03-10', endDate: null }),
    ).toEqual({ ok: true });
    expect(
      checkReleaseWindow({ movieDate: '2030-01-01', timeBegin: '12:00', releaseDate: '2026-03-10', endDate: '' }),
    ).toEqual({ ok: true });
  });

  it('rejects a same-day showtime whose clock time is before an intra-day release is irrelevant (date granularity)', () => {
    // release_date has no time component, so any time on the release date passes.
    expect(
      checkReleaseWindow({ movieDate: '2026-03-10', timeBegin: '06:00', releaseDate: '2026-03-10' }),
    ).toEqual({ ok: true });
  });
});

describe('checkReleaseWindow — timezone independence', () => {
  const ORIGINAL_TZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  // Offsets that straddle UTC in both directions, plus the day-boundary extremes
  // (Kiritimati is UTC+14, Pago Pago is UTC-11). Assigning process.env.TZ re-runs the
  // libc timezone lookup for subsequent Date construction on Unix; on platforms where it
  // is ignored the assertions still hold because the check is timezone-independent by
  // construction (both operands are built from numeric Y/M/D/H/M components).
  const zones = ['UTC', 'Asia/Ho_Chi_Minh', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Los_Angeles'];
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

  for (const tz of zones) {
    it(`TZ=${tz}: start on the release date passes at every hour; the day before never does`, () => {
      process.env.TZ = tz;
      for (const timeBegin of hours) {
        expect(checkReleaseWindow({ movieDate: '2026-03-10', timeBegin, releaseDate: '2026-03-10' })).toEqual({
          ok: true,
        });
        expect(checkReleaseWindow({ movieDate: '2026-03-09', timeBegin, releaseDate: '2026-03-10' })).toEqual({
          ok: false,
          code: 'BEFORE_RELEASE_DATE',
        });
      }
    });

    it(`TZ=${tz}: start anywhere on the end date passes at every hour; the next day fails`, () => {
      process.env.TZ = tz;
      for (const timeBegin of hours) {
        expect(
          checkReleaseWindow({ movieDate: '2026-06-01', timeBegin, releaseDate: '2026-03-10', endDate: '2026-06-01' })
            .ok,
        ).toBe(true);
        expect(
          checkReleaseWindow({ movieDate: '2026-06-02', timeBegin, releaseDate: '2026-03-10', endDate: '2026-06-01' }),
        ).toEqual({ ok: false, code: 'AFTER_RELEASE_END' });
      }
    });
  }
});

describe('evaluateShowtimeAgainstReleases', () => {
  it('says nothing (ok) when the movie has no active release rows', () => {
    expect(evaluateShowtimeAgainstReleases({ movieDate: '2026-01-01', timeBegin: '10:00', releases: [] })).toEqual({
      ok: true,
      code: 'NO_RELEASE',
    });
    expect(
      evaluateShowtimeAgainstReleases({
        movieDate: '2026-01-01',
        timeBegin: '10:00',
        releases: [{ release_date: '2025-01-01', end_date: null, status: 'INACTIVE' }],
      }),
    ).toEqual({ ok: true, code: 'NO_RELEASE' });
  });

  it('passes when the start falls inside ANY active window', () => {
    const releases = [
      { release_date: '2026-01-01', end_date: '2026-02-01', status: 'ACTIVE' },
      { release_date: '2026-06-01', end_date: '2026-07-01', status: 'ACTIVE' },
    ];
    expect(evaluateShowtimeAgainstReleases({ movieDate: '2026-06-15', timeBegin: '20:00', releases }).ok).toBe(true);
  });

  it('reports BEFORE_RELEASE_DATE when the earliest window has not opened yet', () => {
    const releases = [{ release_date: '2026-06-01', end_date: null, status: 'ACTIVE' }];
    expect(evaluateShowtimeAgainstReleases({ movieDate: '2026-05-31', timeBegin: '20:00', releases })).toEqual({
      ok: false,
      code: 'BEFORE_RELEASE_DATE',
    });
  });

  it('reports AFTER_RELEASE_END when every window has already ended', () => {
    const releases = [
      { release_date: '2026-01-01', end_date: '2026-02-01', status: 'ACTIVE' },
      { release_date: '2026-03-01', end_date: '2026-04-01', status: 'ACTIVE' },
    ];
    expect(evaluateShowtimeAgainstReleases({ movieDate: '2026-05-01', timeBegin: '20:00', releases })).toEqual({
      ok: false,
      code: 'AFTER_RELEASE_END',
    });
  });
});
