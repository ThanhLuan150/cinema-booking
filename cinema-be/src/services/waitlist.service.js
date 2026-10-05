const crypto = require('crypto');
const Waitlist = require('../models/Waitlist');
const Schedule = require('../models/Schedule');
const Movie = require('../models/Movie');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const waitlistRepository = require('../repositories/waitlist.repository');
const systemConfigService = require('./systemConfig.service');
const notificationService = require('./notification.service');
const { emitToAccount } = require('../utils/socket');
const { broadcastSeatUpdate } = require('../utils/seatBroadcast');
const { REALTIME_EVENT } = require('../utils/realtimeEvents');

const { STATUS, CLOSE_REASON } = Waitlist;
const ALLOWED_FIELDS = ['schedule_id', 'seat_count'];

class WaitlistError extends Error {
  constructor(code, status, message, extra = {}) {
    super(message);
    this.name = 'WaitlistError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

const fail = (code, status, message, extra) => {
  throw new WaitlistError(code, status, message, extra);
};

function showtimeStart(schedule) {
  // movie_date + time_begin are LOCAL time everywhere in this codebase.
  return new Date(`${schedule.movie_date}T${schedule.time_begin}:00`);
}

const branchOf = (schedule) => schedule.cinema_id ?? null;

// --- views --------------------------------------------------------------------------------------

async function loadShowtimeDetails(scheduleIds) {
  const schedules = await Schedule.find({ id: { $in: scheduleIds } });
  const [movies, rooms, branches] = await Promise.all([
    Movie.find({ id: { $in: schedules.map((s) => s.movie_id) } }, { id: 1, name: 1, avatar: 1 }),
    Room.find({ id: { $in: schedules.map((s) => s.room_id) } }, { id: 1, name: 1 }),
    Branch.find({ id: { $in: schedules.map((s) => s.cinema_id).filter(Boolean) } }, { id: 1, name: 1 }),
  ]);
  const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
  const movieById = byId(movies);
  const roomById = byId(rooms);
  const branchById = byId(branches);
  return new Map(
    schedules.map((s) => {
      const movie = movieById.get(s.movie_id);
      const branch = branchById.get(s.cinema_id);
      return [
        s.id,
        {
          movie: movie ? { id: movie.id, name: movie.name, avatar: movie.avatar } : null,
          branch: branch ? { id: branch.id, name: branch.name } : null,
          showtime: {
            id: s.id,
            movie_date: s.movie_date,
            time_begin: s.time_begin,
            time_end: s.time_end,
            room: roomById.get(s.room_id)?.name ?? null,
            status: s.status,
          },
        },
      ];
    }),
  );
}

// What the customer sees of their own entry. No account id: it is always the caller's.
async function toViews(entries) {
  const details = await loadShowtimeDetails([...new Set(entries.map((e) => e.schedule_id))]);
  return Promise.all(
    entries.map(async (entry) => ({
      id: entry.id,
      schedule_id: entry.schedule_id,
      seat_count: entry.seat_count,
      status: entry.status,
      position: entry.status === STATUS.WAITING ? await waitlistRepository.queuePosition(entry) : null,
      joined_at: entry.createdAt,
      notified_at: entry.notified_at,
      expires_at: entry.expires_at,
      offered_seat_codes: entry.offered_seat_codes,
      booking_id: entry.booking_id,
      booked_at: entry.booked_at,
      expired_at: entry.expired_at,
      cancelled_at: entry.cancelled_at,
      close_reason: entry.close_reason,
      ...(details.get(entry.schedule_id) ?? { movie: null, branch: null, showtime: null }),
    })),
  );
}

async function toView(entry) {
  return (await toViews([entry]))[0];
}

// --- customer API -------------------------------------------------------------------------------

function readJoinRequest(body) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const extra = Object.keys(input).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (extra.length > 0) {
    fail('WAITLIST_FIELD_NOT_ALLOWED', 400, `Only ${ALLOWED_FIELDS.join(', ')} may be sent`, { fields: extra });
  }
  const scheduleId = Number(input.schedule_id);
  if (!Number.isInteger(scheduleId) || scheduleId <= 0) fail('SHOWTIME_REQUIRED', 400, 'Choose the showtime (schedule_id)');
  const seatCount = input.seat_count === undefined || input.seat_count === null ? 1 : Number(input.seat_count);
  return { scheduleId, seatCount };
}

async function loadSchedule(scheduleId) {
  const id = Number(scheduleId);
  if (!Number.isInteger(id) || id <= 0) fail('SHOWTIME_NOT_FOUND', 404, 'Showtime not found');
  const schedule = await Schedule.findOne({ id });
  if (!schedule) fail('SHOWTIME_NOT_FOUND', 404, 'Showtime not found');
  return schedule;
}

async function seatAvailability(schedule, now) {
  const excludeSeatCodes = await waitlistRepository.findDisabledSeatCodes(schedule.room_id);
  return waitlistRepository.countSeats(schedule.id, { excludeSeatCodes, now });
}

// Why this customer may not join this showtime's waitlist right now, or null.
function joinRefusal({ schedule, now, seats, entry, seatCount = 1 }) {
  if (schedule.status !== 'ACTIVE') return { code: 'SCHEDULE_CANCELLED', status: 400, message: 'This showtime has been cancelled' };
  if (now >= showtimeStart(schedule)) {
    return { code: 'SHOWTIME_STARTED', status: 400, message: 'This showtime has already started' };
  }
  if (seats.total === 0) {
    return { code: 'SHOWTIME_NOT_BOOKABLE', status: 409, message: 'This showtime has no seats on sale' };
  }
  if (seatCount > seats.total) {
    return {
      code: 'WAITLIST_SEAT_COUNT_INVALID',
      status: 400,
      message: `This showtime only has ${seats.total} seat(s)`,
      extra: { max: seats.total },
    };
  }
  if (entry) {
    return { code: 'WAITLIST_DUPLICATE', status: 409, message: 'You are already on the waitlist for this showtime' };
  }
  if (seats.available >= seatCount) {
    return {
      code: 'SHOWTIME_NOT_FULL',
      status: 409,
      message: 'Seats are still available for this showtime — book them directly',
      extra: { available_seats: seats.available },
    };
  }
  return null;
}

async function join({ accountId, body, now = new Date() }) {
  const { scheduleId, seatCount } = readJoinRequest(body);
  const schedule = await loadSchedule(scheduleId);

  const maxSeats = await systemConfigService.getValue('MAX_BOOKING_SEATS', branchOf(schedule));
  if (!Number.isInteger(seatCount) || seatCount < 1 || seatCount > maxSeats) {
    fail('WAITLIST_SEAT_COUNT_INVALID', 400, `seat_count must be a whole number from 1 to ${maxSeats}`, { max: maxSeats });
  }

  const [seats, existing] = await Promise.all([
    seatAvailability(schedule, now),
    waitlistRepository.findActiveForAccount(schedule.id, accountId),
  ]);
  const refusal = joinRefusal({ schedule, now, seats, entry: existing, seatCount });
  if (refusal) {
    const extra = existing ? { entry: await toView(existing) } : refusal.extra;
    fail(refusal.code, refusal.status, refusal.message, extra);
  }

  const entry = await waitlistRepository.createEntry({
    accountId,
    scheduleId: schedule.id,
    branchId: branchOf(schedule),
    movieId: schedule.movie_id,
    seatCount,
  });
  if (!entry) {
    // Lost a race with the customer's own other join (another tab, a double tap).
    const winner = await waitlistRepository.findActiveForAccount(schedule.id, accountId);
    fail('WAITLIST_DUPLICATE', 409, 'You are already on the waitlist for this showtime', {
      entry: winner ? await toView(winner) : null,
    });
  }
  emitStatus(entry);
  // Fewer seats are left than this customer asked for, but some are: they may be exactly what an
  // earlier customer in the queue is waiting for.
  if (seats.available > 0) await processSchedule(schedule.id);

  return toView((await waitlistRepository.findByIdForAccount(entry.id, accountId)) ?? entry);
}

async function listMine({ accountId, statuses = null, skip = 0, limit = 20 }) {
  const { data, total } = await waitlistRepository.findForAccount(accountId, { statuses, skip, limit });
  return { data: await toViews(data), total };
}

// Someone else's entry answers exactly like one that does not exist.
async function loadOwnEntry(id, accountId) {
  const entryId = Number(id);
  const entry = Number.isInteger(entryId) && entryId > 0 ? await waitlistRepository.findByIdForAccount(entryId, accountId) : null;
  if (!entry) fail('WAITLIST_NOT_FOUND', 404, 'Waitlist entry not found');
  return entry;
}

async function getMine({ id, accountId }) {
  return toView(await loadOwnEntry(id, accountId));
}

async function cancelMine({ id, accountId, now = new Date() }) {
  const entry = await loadOwnEntry(id, accountId);
  const cancelled = await waitlistRepository.cancelForAccount(entry.id, accountId, now);
  if (!cancelled) {
    const current = await waitlistRepository.findByIdForAccount(entry.id, accountId);
    fail('WAITLIST_NOT_ACTIVE', 409, `This waitlist entry is already ${String(current?.status).toLowerCase()}`, {
      status: current?.status ?? null,
    });
  }
  emitStatus(cancelled);
  if (cancelled.offered_ticket_ids.length > 0) {
    // Declining an offer passes its seats straight to the next customer in the queue.
    await releaseOffer(cancelled, now);
    await processSchedule(cancelled.schedule_id);
  } else {
    await announceQueueMoved(cancelled.schedule_id);
  }
  return toView(cancelled);
}

async function getShowtimeStatus({ scheduleId, accountId, now = new Date() }) {
  const schedule = await loadSchedule(scheduleId);
  const branchId = branchOf(schedule);
  const [seats, entry, waitingCount, maxSeats, offerMinutes] = await Promise.all([
    seatAvailability(schedule, now),
    waitlistRepository.findActiveForAccount(schedule.id, accountId),
    waitlistRepository.countWaiting(schedule.id),
    systemConfigService.getValue('MAX_BOOKING_SEATS', branchId),
    systemConfigService.getValue('WAITLIST_OFFER_TIME', branchId),
  ]);
  const refusal = joinRefusal({ schedule, now, seats, entry });
  return {
    schedule_id: schedule.id,
    total_seats: seats.total,
    available_seats: seats.available,
    full: seats.total > 0 && seats.available === 0,
    waiting_count: waitingCount,
    max_seat_count: maxSeats,
    offer_minutes: offerMinutes,
    can_join: !refusal,
    reason: refusal ? { code: refusal.code, message: refusal.message } : null,
    entry: entry ? await toView(entry) : null,
  };
}

// --- the queue ----------------------------------------------------------------------------------

function emitStatus(entry) {
  emitToAccount(entry.account_id, REALTIME_EVENT.WAITLIST_UPDATED, {
    id: entry.id,
    schedule_id: entry.schedule_id,
    status: entry.status,
  });
}

// Everyone still waiting moved up a place (or may have): their panels refetch their position.
async function announceQueueMoved(scheduleId) {
  for (const accountId of await waitlistRepository.findWaitingAccountIds(scheduleId)) {
    emitToAccount(accountId, REALTIME_EVENT.WAITLIST_UPDATED, { schedule_id: Number(scheduleId), status: STATUS.WAITING });
  }
}

// Hands back an offer's seats — except any the customer has taken into a checkout still in progress.
async function releaseOffer(entry, now) {
  if (entry.offered_ticket_ids.length === 0) return [];
  const inCheckout = await waitlistRepository.findCheckoutTicketIds(entry, now);
  return waitlistRepository.releaseSeats(entry.offered_ticket_ids, entry.account_id, { exceptTicketIds: inCheckout });
}

async function closeAll(scheduleId, { status, reason, now }) {
  const closed = [];
  for (const entry of await waitlistRepository.findByStatus(scheduleId, Waitlist.ACTIVE_STATUSES)) {
    const done = await waitlistRepository.closeEntry(entry.id, { status, reason, now });
    if (!done) continue;
    await releaseOffer(done, now);
    closed.push(done);
  }
  return closed;
}

// Settles the offers already out: booked, still running (their seats restored if they slipped), or
// lapsed. A lapsed offer whose customer is mid-payment is left to that payment's own expiry.
async function settleOffers(scheduleId, now, outcome) {
  for (const entry of await waitlistRepository.findByStatus(scheduleId, [STATUS.NOTIFIED])) {
    const paid = await waitlistRepository.findPaidBookingSince(entry);
    if (paid) {
      const booked = await waitlistRepository.markBookedById(entry.id, { bookingId: paid.id, now });
      if (booked) {
        await releaseOffer(booked, now);
        outcome.booked.push(booked);
      }
      continue;
    }
    if (entry.expires_at > now) {
      await waitlistRepository.reholdOffer(entry);
      continue;
    }
    const inCheckout = await waitlistRepository.findCheckoutTicketIds(entry, now);
    if (inCheckout.some((id) => entry.offered_ticket_ids.includes(id))) continue;

    const expired = await waitlistRepository.expireOffer(entry.id, now);
    if (expired) {
      await releaseOffer(expired, now);
      outcome.expired.push(expired);
    }
  }
}

// Strictly in join order: the head of the queue is served first, and while there are not enough
// free seats for the head, nobody behind it is served either.
async function offerFreedSeats(schedule, now, outcome) {
  const offerMinutes = await systemConfigService.getValue('WAITLIST_OFFER_TIME', branchOf(schedule));
  // Never past the start of the show — the seats would be useless by then.
  const expiresAt = new Date(Math.min(now.getTime() + offerMinutes * 60 * 1000, showtimeStart(schedule).getTime()));
  const excludeSeatCodes = await waitlistRepository.findDisabledSeatCodes(schedule.room_id);

  for (;;) {
    const head = await waitlistRepository.findHead(schedule.id);
    if (!head) return;
    const claimed = await waitlistRepository.claimSeats({
      scheduleId: schedule.id,
      accountId: head.account_id,
      count: head.seat_count,
      until: expiresAt,
      excludeSeatCodes,
    });
    const giveBack = () => waitlistRepository.releaseSeats(claimed.map((t) => t.id), head.account_id);
    if (claimed.length < head.seat_count) {
      await giveBack();
      return;
    }
    const offered = await waitlistRepository.markNotified(head.id, { tickets: claimed, now, expiresAt });
    if (!offered) {
      // The customer left the queue while their seats were being picked.
      await giveBack();
      continue;
    }
    broadcastSeatUpdate(claimed, 'HELD');
    outcome.offered.push(offered);
  }
}

// Records what it did into `outcome` as it goes, so a failure part-way still reports the offers made.
async function runQueue(scheduleId, now, outcome) {
  const schedule = await Schedule.findOne({ id: scheduleId });
  if (!schedule || schedule.status !== 'ACTIVE') {
    outcome.closed.push(
      ...(await closeAll(scheduleId, { status: STATUS.CANCELLED, reason: CLOSE_REASON.SHOWTIME_CANCELLED, now })),
    );
    return;
  }
  if (now >= showtimeStart(schedule)) {
    outcome.closed.push(...(await closeAll(scheduleId, { status: STATUS.EXPIRED, reason: CLOSE_REASON.SHOWTIME_STARTED, now })));
    return;
  }
  await settleOffers(scheduleId, now, outcome);
  await offerFreedSeats(schedule, now, outcome);
}

async function notifyOutcome(scheduleId, outcome) {
  const details = (await loadShowtimeDetails([scheduleId])).get(scheduleId);
  const ctx = details
    ? {
        movie: details.movie?.name,
        branch: details.branch?.name,
        room: details.showtime.room,
        showtime: { date: details.showtime.movie_date, time_begin: details.showtime.time_begin, time_end: details.showtime.time_end },
        movieId: details.movie?.id,
        scheduleId,
      }
    : { scheduleId };

  for (const entry of outcome.offered) {
    emitStatus(entry);
    await notificationService.notify({
      event: notificationService.EVENT.WAITLIST_SEAT_AVAILABLE,
      accountId: entry.account_id,
      data: {
        ...ctx,
        seats: entry.offered_seat_codes,
        expiresAt: entry.expires_at,
        // The window actually given — shorter than the setting when the show starts sooner.
        offerMinutes: Math.max(1, Math.round((entry.expires_at - entry.notified_at) / 60000)),
        waitlistId: entry.id,
      },
      channels: [notificationService.CHANNEL.IN_APP, notificationService.CHANNEL.EMAIL],
      dedupeKey: `WAITLIST_SEAT_AVAILABLE:${entry.id}`,
    });
  }
  for (const entry of [...outcome.expired, ...outcome.closed]) {
    emitStatus(entry);
    const cancelled = entry.status === STATUS.CANCELLED;
    const event = cancelled ? notificationService.EVENT.WAITLIST_CANCELLED : notificationService.EVENT.WAITLIST_EXPIRED;
    await notificationService.notify({
      event,
      accountId: entry.account_id,
      data: { ...ctx, reason: entry.close_reason, seats: entry.offered_seat_codes, waitlistId: entry.id },
      dedupeKey: `${event}:${entry.id}`,
    });
  }
  for (const entry of outcome.booked) emitStatus(entry);
  if (outcome.offered.length > 0 || outcome.expired.length > 0) await announceQueueMoved(scheduleId);
}

// Hands a showtime's free seats to its waitlist. One run per showtime at a time (a lease in
// WaitlistLock); a call that finds the lease taken asks the holder to go round again rather than
// running alongside it, so two simultaneous releases can never serve the queue out of order.
async function processSchedule(scheduleId, { now = null } = {}) {
  const id = Number(scheduleId);
  const outcome = { offered: [], expired: [], booked: [], closed: [] };
  if (!(await waitlistRepository.hasActiveEntries(id))) return outcome;

  const owner = crypto.randomUUID();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await waitlistRepository.acquireLock(id, owner)) {
      let failure = null;
      try {
        let state;
        do {
          await runQueue(id, now ?? new Date(), outcome);
          state = await waitlistRepository.releaseLock(id, owner);
        } while (state === 'rerun');
      } catch (err) {
        failure = err;
        await waitlistRepository.abandonLock(id, owner);
      }
      await notifyOutcome(id, outcome);
      if (failure) throw failure;
      return outcome;
    }
    if (await waitlistRepository.requestRerun(id)) return outcome;
    // The holder let go between our two calls — try to take the lease ourselves.
  }
  return outcome; // Still contended: the sweep will get to it.
}

// --- hooks (never throw) ------------------------------------------------------------------------

async function onSeatsReleased(tickets) {
  const scheduleIds = [...new Set((tickets || []).map((t) => Number(t && t.schedule_id)).filter(Boolean))];
  for (const scheduleId of scheduleIds) {
    try {
      await processSchedule(scheduleId);
    } catch (err) {
      console.error(`[waitlist] failed to process showtime ${scheduleId}`, err.message);
    }
  }
}

async function onBookingPaid(booking) {
  try {
    if (!booking || !booking.account_id || !booking.schedule_id) return null;
    const now = new Date();
    const entry = await waitlistRepository.markBookedForAccount(booking.schedule_id, booking.account_id, {
      bookingId: booking.id,
      now,
    });
    if (!entry) return null;
    emitStatus(entry);
    // Offered seats they did not take into this booking go on to the next customer now.
    if ((await releaseOffer(entry, now)).length > 0) await processSchedule(entry.schedule_id);
    return entry;
  } catch (err) {
    console.error(`[waitlist] failed to close the entry for booking ${booking && booking.id}`, err.message);
    return null;
  }
}

// Expires lapsed offers, closes queues whose showtime started, and catches any release a hook missed.
async function sweep({ now = null } = {}) {
  try {
    const scheduleIds = await waitlistRepository.findActiveScheduleIds();
    for (const scheduleId of scheduleIds) {
      try {
        await processSchedule(scheduleId, { now });
      } catch (err) {
        console.error(`[waitlist] sweep failed for showtime ${scheduleId}`, err.message);
      }
    }
    return scheduleIds.length;
  } catch (err) {
    console.error('[waitlist] sweep failed', err.message);
    return 0;
  }
}

module.exports = {
  WaitlistError,
  join,
  listMine,
  getMine,
  cancelMine,
  getShowtimeStatus,
  processSchedule,
  onSeatsReleased,
  onBookingPaid,
  sweep,
};
