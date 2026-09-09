import { afterEach, describe, expect, it } from 'vitest';
import { checkReleaseWindow, evaluateShowtimeAgainstReleases } from './releaseWindow';

describe('checkReleaseWindow — boundary dates', () => {
  it('allows a showtime exactly at 00:00 on the release date', () => {
    expect(checkReleaseWindow({ movieDate: '2026-03-10', timeBegin: '00:00', releaseDate: '2026-03-10' })).toEqual({
      ok: true,
    });
  });

  it('allows a showtime late on the release date', () => {
    expect(checkReleaseWindow({ movieDate: '2026-03-10', timeBegin: '23:59', releaseDate: '2026-03-10' })).toEqual({
      ok: true,
    });
  });

  it('rejects the day before the release date', () => {
    expect(checkReleaseWindow({ movieDate: '2026-03-09', timeBegin: '23:59', releaseDate: '2026-03-10' })).toEqual({
      ok: false,
      code: 'BEFORE_RELEASE_DATE',
    });
  });

  it('treats the end date as inclusive of the whole day', () => {
    expect(
      checkReleaseWindow({
        movieDate: '2026-06-01',
        timeBegin: '23:30',
        releaseDate: '2026-03-10',
        endDate: '2026-06-01',
      }),
    ).toEqual({ ok: true });
  });

  it('rejects the day after the end date', () => {
    expect(
      checkReleaseWindow({
        movieDate: '2026-06-02',
        timeBegin: '00:00',
        releaseDate: '2026-03-10',
        endDate: '2026-06-01',
      }),
    ).toEqual({ ok: false, code: 'AFTER_RELEASE_END' });
  });

  it('treats a null / empty end date as open-ended', () => {
    expect(
      checkReleaseWindow({ movieDate: '2099-01-01', timeBegin: '12:00', releaseDate: '2026-03-10', endDate: null }).ok,
    ).toBe(true);
    expect(
      checkReleaseWindow({ movieDate: '2099-01-01', timeBegin: '12:00', releaseDate: '2026-03-10', endDate: '' }).ok,
    ).toBe(true);
  });
});

describe('checkReleaseWindow — timezone independence', () => {
  const ORIGINAL_TZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  const zones = ['UTC', 'Asia/Ho_Chi_Minh', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'America/Los_Angeles'];
  const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

  for (const tz of zones) {
    it(`TZ=${tz}: release-date boundary holds at every hour`, () => {
      process.env.TZ = tz;
      for (const timeBegin of hours) {
        expect(checkReleaseWindow({ movieDate: '2026-03-10', timeBegin, releaseDate: '2026-03-10' }).ok).toBe(true);
        expect(checkReleaseWindow({ movieDate: '2026-03-09', timeBegin, releaseDate: '2026-03-10' })).toEqual({
          ok: false,
          code: 'BEFORE_RELEASE_DATE',
        });
      }
    });

    it(`TZ=${tz}: end-date boundary holds at every hour`, () => {
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
  it('passes when the movie has no active release rows', () => {
    expect(evaluateShowtimeAgainstReleases({ movieDate: '2026-01-01', timeBegin: '10:00', releases: [] }).ok).toBe(
      true,
    );
    expect(
      evaluateShowtimeAgainstReleases({
        movieDate: '2026-01-01',
        timeBegin: '10:00',
        releases: [{ release_date: '2030-01-01', end_date: null, status: 'INACTIVE' }],
      }).ok,
    ).toBe(true);
  });

  it('passes when the start is inside any active window', () => {
    const releases = [
      { release_date: '2026-01-01', end_date: '2026-02-01', status: 'ACTIVE' as const },
      { release_date: '2026-06-01', end_date: '2026-07-01', status: 'ACTIVE' as const },
    ];
    expect(evaluateShowtimeAgainstReleases({ movieDate: '2026-06-15', timeBegin: '20:00', releases }).ok).toBe(true);
  });

  it('reports BEFORE_RELEASE_DATE / AFTER_RELEASE_END appropriately', () => {
    expect(
      evaluateShowtimeAgainstReleases({
        movieDate: '2026-05-31',
        timeBegin: '20:00',
        releases: [{ release_date: '2026-06-01', end_date: null, status: 'ACTIVE' }],
      }),
    ).toEqual({ ok: false, code: 'BEFORE_RELEASE_DATE' });

    expect(
      evaluateShowtimeAgainstReleases({
        movieDate: '2026-05-01',
        timeBegin: '20:00',
        releases: [{ release_date: '2026-01-01', end_date: '2026-02-01', status: 'ACTIVE' }],
      }),
    ).toEqual({ ok: false, code: 'AFTER_RELEASE_END' });
  });
});
