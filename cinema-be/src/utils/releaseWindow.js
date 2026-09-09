const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isValidDateStr(value) {
  return typeof value === 'string' && DATE_RE.test(value);
}

// Build a local Date from 'YYYY-MM-DD' + 'HH:mm'. Missing/blank time -> 00:00.
function localDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  let hh = 0;
  let mm = 0;
  if (typeof timeStr === 'string' && TIME_RE.test(timeStr)) {
    [hh, mm] = timeStr.split(':').map(Number);
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/**
 * @returns {{ ok: boolean, code?: 'BEFORE_RELEASE_DATE'|'AFTER_RELEASE_END' }}
 */
function checkReleaseWindow({ movieDate, timeBegin, releaseDate, endDate }) {
  if (!isValidDateStr(movieDate) || !isValidDateStr(releaseDate)) {
    // Caller is responsible for shape validation; treat unknown input as "not satisfied".
    return { ok: false, code: 'BEFORE_RELEASE_DATE' };
  }

  const start = localDateTime(movieDate, timeBegin);

  const releaseStart = localDateTime(releaseDate, '00:00');
  if (start.getTime() < releaseStart.getTime()) {
    return { ok: false, code: 'BEFORE_RELEASE_DATE' };
  }

  if (isValidDateStr(endDate)) {
    const releaseEnd = localDateTime(endDate, '23:59');
    releaseEnd.setSeconds(59, 999);
    if (start.getTime() > releaseEnd.getTime()) {
      return { ok: false, code: 'AFTER_RELEASE_END' };
    }
  }

  return { ok: true };
}

/**
 * Evaluate a showtime against a set of MovieRelease rows (already filtered to the movie).
 * Passes when the start falls inside ANY active window. When it fails, returns the most
 * useful single code: AFTER_RELEASE_END only if every candidate window has already ended,
 * otherwise BEFORE_RELEASE_DATE.
 *
 * @param {Array<{release_date:string,end_date:?string,status?:string}>} releases
 * @returns {{ ok: boolean, code?: string }}
 */
function evaluateShowtimeAgainstReleases({ movieDate, timeBegin, releases }) {
  const active = (releases || []).filter((r) => !r.status || r.status === 'ACTIVE');
  if (active.length === 0) {
    // No release info recorded for this movie — this helper says nothing; the caller
    // decides whether that is allowed.
    return { ok: true, code: 'NO_RELEASE' };
  }

  let sawBeforeOnly = true;
  for (const release of active) {
    const result = checkReleaseWindow({
      movieDate,
      timeBegin,
      releaseDate: release.release_date,
      endDate: release.end_date,
    });
    if (result.ok) return { ok: true };
    if (result.code !== 'AFTER_RELEASE_END') sawBeforeOnly = false;
  }

  return { ok: false, code: sawBeforeOnly ? 'AFTER_RELEASE_END' : 'BEFORE_RELEASE_DATE' };
}

module.exports = { checkReleaseWindow, evaluateShowtimeAgainstReleases, isValidDateStr };
