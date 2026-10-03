const ORDER_CUTOFF_BEFORE_END_MINUTES = 15;
const DEFAULT_OPENS_BEFORE_START_MINUTES = 60;
const FALLBACK_DURATION_MINUTES = 180;
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

// Strict shape first: V8's Date parser is lenient enough to turn garbage like 'xTy:00' into a date.
function parseLocal(date, time) {
  if (typeof date !== 'string' || typeof time !== 'string') return NaN;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  return new Date(`${date}T${time}:00`).getTime();
}

// { startsAt, endsAt } in epoch ms. A showtime that runs past midnight (23:00 -> 01:10) ends on
// the next day; a missing/garbled end falls back to a generous fixed duration.
function showtimeBounds(schedule) {
  const startsAt = parseLocal(schedule.movie_date, schedule.time_begin);
  if (Number.isNaN(startsAt)) return null;
  let endsAt = parseLocal(schedule.movie_date, schedule.time_end);
  if (Number.isNaN(endsAt)) endsAt = startsAt + FALLBACK_DURATION_MINUTES * MINUTE;
  else if (endsAt <= startsAt) endsAt += DAY;
  return { startsAt, endsAt };
}

function orderingWindow(
  schedule,
  {
    opensBeforeMinutes = DEFAULT_OPENS_BEFORE_START_MINUTES,
    cutoffBeforeEndMinutes = ORDER_CUTOFF_BEFORE_END_MINUTES,
  } = {},
) {
  const bounds = showtimeBounds(schedule);
  if (!bounds) return null;
  const opens = Number.isFinite(Number(opensBeforeMinutes)) ? Number(opensBeforeMinutes) : DEFAULT_OPENS_BEFORE_START_MINUTES;
  return {
    ...bounds,
    opensAt: bounds.startsAt - opens * MINUTE,
    closesAt: bounds.endsAt - cutoffBeforeEndMinutes * MINUTE,
  };
}

// -> { window } when ordering is open at `now`, otherwise { error, window } with error one of
// IN_SEAT_ORDERING_NOT_OPEN (too early) / IN_SEAT_ORDERING_CLOSED (too late or unparseable showtime).
function checkOrderingWindow(schedule, now, options) {
  const window = orderingWindow(schedule, options);
  const at = now instanceof Date ? now.getTime() : Number(now);
  if (!window) return { error: 'IN_SEAT_ORDERING_CLOSED', window: null };
  if (at < window.opensAt) return { error: 'IN_SEAT_ORDERING_NOT_OPEN', window };
  if (at >= window.closesAt) return { error: 'IN_SEAT_ORDERING_CLOSED', window };
  return { window };
}

module.exports = {
  ORDER_CUTOFF_BEFORE_END_MINUTES,
  DEFAULT_OPENS_BEFORE_START_MINUTES,
  showtimeBounds,
  orderingWindow,
  checkOrderingWindow,
};
