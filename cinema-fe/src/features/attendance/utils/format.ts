// Attendance times are instants; what they read as depends on the branch's timezone, so every
// formatter here takes the row's own IANA zone instead of using the browser's. An employee
// travelling, or an admin in another country, still sees the branch's wall clock.

function safeZone(timeZone: string | undefined): string | undefined {
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return timeZone;
  } catch {
    return undefined; // an unknown zone falls back to the browser's rather than throwing
  }
}

export function formatClock(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    timeZone: safeZone(timeZone),
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

// Offset of `timeZone` from UTC at `instant`, in minutes (east positive).
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

// Turns a wall-clock reading ('YYYY-MM-DD' + 'HH:mm') in `timeZone` into an ISO-8601 string that
// carries its offset, e.g. ('2026-09-10', '17:30', 'Asia/Ho_Chi_Minh') -> '2026-09-10T17:30:00+07:00'.
// The backend refuses a bare local time, so the form has to say which zone the manager meant.
// Returns null for input that is not a real date/time or a zone that does not exist.
export function toOffsetTimestamp(date: string, time: string, timeZone: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch || !safeZone(timeZone)) return null;

  const [y, mo, d] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [h, mi] = [Number(timeMatch[1]), Number(timeMatch[2])];
  if (h > 23 || mi > 59) return null;
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;

  // Two passes settle the offset around a DST change: guess with the offset at the naive UTC
  // instant, then correct with the offset at the resulting instant.
  const naiveUtc = Date.UTC(y, mo - 1, d, h, mi);
  let offset = zoneOffsetMinutes(new Date(naiveUtc), timeZone);
  offset = zoneOffsetMinutes(new Date(naiveUtc - offset * 60000), timeZone);

  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dateMatch[0]}T${timeMatch[0]}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
