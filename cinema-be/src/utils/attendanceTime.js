// Timezone helpers for Attendance.
//
// A clock-in is a moment in time (an absolute instant), but "which work day does it belong to"
// is a calendar question that depends on where the branch is. The server clock is the only
// source of truth for the instant; the branch's IANA timezone decides the work_date. Nothing
// here uses the process's local timezone or toISOString(), so the result is the same on a UTC
// host and on a host set to the branch's zone.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// An ISO-8601 instant that carries its own offset (Z or ±hh[:mm]). A bare local time such as
// "2026-09-26T08:00:00" is ambiguous, so it is rejected instead of being read in some zone.
const OFFSET_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/;
// Region/City style names (Asia/Ho_Chi_Minh, America/Argentina/Buenos_Aires) and UTC. This keeps
// out fixed-offset strings ("+07:00") and abbreviations ("ICT") that some Node versions accept
// from Intl but that do not follow DST/history rules.
const IANA_NAME_RE = /^(UTC|[A-Za-z]+(\/[A-Za-z0-9_+-]+)+)$/;

const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

// The ICU-resolved identity of a zone, or null when it is not a real one. Only used to compare
// zones: the runtime may resolve a name to a legacy alias (Node 20 turns Asia/Ho_Chi_Minh into
// Asia/Saigon), which is not something to show users or store.
function resolveZone(trimmed) {
  if (!IANA_NAME_RE.test(trimmed)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

// The trimmed name as given when it is a real IANA timezone, else null. Spelling is preserved
// on purpose (see resolveZone); use sameTimeZone to compare two names.
function normalizeTimeZone(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return resolveZone(trimmed) ? trimmed : null;
}

// True when both are valid and denote the same zone, regardless of case or alias spelling.
function sameTimeZone(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const zoneA = resolveZone(a.trim());
  return zoneA !== null && zoneA === resolveZone(b.trim());
}

function isValidTimeZone(value) {
  return normalizeTimeZone(value) !== null;
}

// True for a real calendar day in 'YYYY-MM-DD' form ('2026-02-30' is not one).
function isValidDateString(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

// The 'YYYY-MM-DD' calendar day that `instant` falls on in `timeZone`.
function workDateFor(instant, timeZone) {
  const zone = normalizeTimeZone(timeZone);
  if (!zone) throw new Error(`Invalid timezone: ${timeZone}`);
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new Error('Invalid instant');
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Parses an ISO-8601 timestamp that carries an explicit offset into a Date. Returns null for
// anything else, including a valid-looking string with no offset.
function parseOffsetTimestamp(value) {
  if (typeof value !== 'string' || !OFFSET_TIMESTAMP_RE.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

module.exports = {
  DEFAULT_TIMEZONE,
  normalizeTimeZone,
  isValidTimeZone,
  sameTimeZone,
  isValidDateString,
  workDateFor,
  parseOffsetTimestamp,
};
