import type { MovieRelease } from '@/types/entities';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export type ReleaseWindowCode = 'BEFORE_RELEASE_DATE' | 'AFTER_RELEASE_END';

export interface ReleaseWindowResult {
  ok: boolean;
  code?: ReleaseWindowCode;
}

// Build a local Date from 'YYYY-MM-DD' (+ optional 'HH:mm'). Numeric components only, so the
// result is always in the host's local zone — mirrors the backend's utils/releaseWindow.js so
// the client-side hint agrees with the server's decision.
function localDateTime(dateStr: string, timeStr?: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 0;
  let mm = 0;
  if (timeStr && TIME_RE.test(timeStr)) {
    [hh, mm] = timeStr.split(':').map(Number);
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

export function checkReleaseWindow(params: {
  movieDate: string;
  timeBegin?: string;
  releaseDate: string;
  endDate?: string | null;
}): ReleaseWindowResult {
  const { movieDate, timeBegin, releaseDate, endDate } = params;
  if (!DATE_RE.test(movieDate) || !DATE_RE.test(releaseDate)) {
    return { ok: false, code: 'BEFORE_RELEASE_DATE' };
  }

  const start = localDateTime(movieDate, timeBegin);

  if (start.getTime() < localDateTime(releaseDate, '00:00').getTime()) {
    return { ok: false, code: 'BEFORE_RELEASE_DATE' };
  }

  if (endDate && DATE_RE.test(endDate)) {
    const releaseEnd = localDateTime(endDate, '23:59');
    releaseEnd.setSeconds(59, 999);
    if (start.getTime() > releaseEnd.getTime()) {
      return { ok: false, code: 'AFTER_RELEASE_END' };
    }
  }

  return { ok: true };
}

// Evaluate a candidate showtime against a movie's release rows. Passes when the movie has no
// active release rows (nothing to enforce) or the start falls inside ANY active window.
export function evaluateShowtimeAgainstReleases(params: {
  movieDate: string;
  timeBegin?: string;
  releases: Pick<MovieRelease, 'release_date' | 'end_date' | 'status'>[];
}): ReleaseWindowResult {
  const active = (params.releases ?? []).filter((r) => !r.status || r.status === 'ACTIVE');
  if (active.length === 0) return { ok: true };

  let sawBeforeOnly = true;
  for (const release of active) {
    const result = checkReleaseWindow({
      movieDate: params.movieDate,
      timeBegin: params.timeBegin,
      releaseDate: release.release_date,
      endDate: release.end_date,
    });
    if (result.ok) return { ok: true };
    if (result.code !== 'AFTER_RELEASE_END') sawBeforeOnly = false;
  }
  return { ok: false, code: sawBeforeOnly ? 'AFTER_RELEASE_END' : 'BEFORE_RELEASE_DATE' };
}
