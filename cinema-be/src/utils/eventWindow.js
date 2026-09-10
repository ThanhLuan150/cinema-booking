const TIME_RE = /^\d{2}:\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const MIN_DURATION_MINUTES = 30;
const MAX_DURATION_HOURS = 24;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Local 'YYYY-MM-DD' for a Date (uses the process's local timezone, matching how Schedule
// rows are authored).
function localDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Build a LOCAL Date from 'YYYY-MM-DD' + 'HH:mm'. Missing / malformed time -> 00:00.
function localDateTime(dateStr, timeStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  let hh = 0;
  let mm = 0;
  if (typeof timeStr === 'string' && TIME_RE.test(timeStr)) {
    [hh, mm] = timeStr.split(':').map(Number);
  }
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

// Validate + normalise a requested rental window. Returns { start, end } (Date) on success,
// or { error, code } on failure.
function parseEventWindow({ start_at, end_at } = {}) {
  const start = toDate(start_at);
  const end = toDate(end_at);
  if (!start || !end) {
    return { error: 'start_at and end_at must be valid date-times', code: 'INVALID_EVENT_WINDOW' };
  }
  if (start.getTime() >= end.getTime()) {
    return { error: 'start_at must be before end_at', code: 'INVALID_EVENT_WINDOW' };
  }
  const minutes = (end.getTime() - start.getTime()) / 60000;
  if (minutes < MIN_DURATION_MINUTES) {
    return { error: `An event must run for at least ${MIN_DURATION_MINUTES} minutes`, code: 'EVENT_TOO_SHORT' };
  }
  if (minutes > MAX_DURATION_HOURS * 60) {
    return { error: `An event cannot run longer than ${MAX_DURATION_HOURS} hours`, code: 'EVENT_TOO_LONG' };
  }
  return { start, end };
}

// The set of local 'YYYY-MM-DD' strings the window touches — the `movie_date` values worth
// pulling Schedule rows for. Inclusive of the end day (cheap, and covers a window that ends
// exactly at midnight or a showtime that starts late on the last day).
function coveredDateStrs(start, end) {
  const out = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // Guard against a pathological range; MAX_DURATION_HOURS keeps this to <= 2 iterations anyway.
  for (let i = 0; i < 32 && cur.getTime() <= last.getTime(); i += 1) {
    out.push(localDateStr(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). Touching at an endpoint
// (one ends exactly when the other starts) is NOT a conflict.
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

// A showtime's local [start, end). Handles the rare showtime that runs past midnight
// (time_end <= time_begin) by pushing the end to the next day.
function scheduleInterval(schedule) {
  const start = localDateTime(schedule.movie_date, schedule.time_begin);
  let end = localDateTime(schedule.movie_date, schedule.time_end);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + DAY_MS);
  }
  return { start, end };
}

// First showtime in `schedules` whose local window overlaps [start, end). CANCELLED showtimes
// are ignored (their slot is free). Returns the row, or null.
function findShowtimeConflict({ start, end, schedules }) {
  for (const s of schedules || []) {
    if (s && s.status === 'CANCELLED') continue;
    const iv = scheduleInterval(s);
    if (intervalsOverlap(start, end, iv.start, iv.end)) return s;
  }
  return null;
}

// First private event in `events` whose window overlaps [start, end). `excludeId` skips the
// event being re-checked so it doesn't collide with itself. Callers should pass only
// non-CANCELLED events (see PrivateEvent.BLOCKING_STATUSES). Returns the row, or null.
function findEventConflict({ start, end, events, excludeId }) {
  for (const e of events || []) {
    if (!e) continue;
    if (excludeId !== undefined && Number(e.id) === Number(excludeId)) continue;
    const eStart = toDate(e.start_at);
    const eEnd = toDate(e.end_at);
    if (!eStart || !eEnd) continue;
    if (intervalsOverlap(start, end, eStart, eEnd)) return e;
  }
  return null;
}

module.exports = {
  MIN_DURATION_MINUTES,
  MAX_DURATION_HOURS,
  toDate,
  localDateStr,
  localDateTime,
  parseEventWindow,
  coveredDateStrs,
  intervalsOverlap,
  scheduleInterval,
  findShowtimeConflict,
  findEventConflict,
};
