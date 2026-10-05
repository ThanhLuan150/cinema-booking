const Waitlist = require('../models/Waitlist');
const WaitlistLock = require('../models/WaitlistLock');
const Ticket = require('../models/Ticket');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const nextId = require('../utils/nextId');
const { broadcastSeatUpdate } = require('../utils/seatBroadcast');

const { STATUS, ACTIVE_STATUSES, CLOSE_REASON } = Waitlist;

const LOCK_LEASE_MS = 60 * 1000;

// --- entries ------------------------------------------------------------------------------------

// Returns null when the customer already has an active entry for this showtime (the partial unique
// index refused it), so a duplicate can never get in, however the joins interleave.
async function createEntry({ accountId, scheduleId, branchId = null, movieId = null, seatCount }) {
  try {
    return await Waitlist.create({
      id: await nextId('waitlist'),
      account_id: Number(accountId),
      schedule_id: Number(scheduleId),
      branch_id: branchId,
      movie_id: movieId,
      seat_count: seatCount,
    });
  } catch (err) {
    if (err.code === 11000 && err.keyPattern && 'account_id' in err.keyPattern) return null;
    throw err;
  }
}

async function findActiveForAccount(scheduleId, accountId) {
  return Waitlist.findOne({
    schedule_id: Number(scheduleId),
    account_id: Number(accountId),
    status: { $in: ACTIVE_STATUSES },
  });
}

async function findByIdForAccount(id, accountId) {
  return Waitlist.findOne({ id: Number(id), account_id: Number(accountId) });
}

async function findForAccount(accountId, { statuses = null, skip = 0, limit = 20 } = {}) {
  const filter = { account_id: Number(accountId) };
  if (statuses && statuses.length > 0) filter.status = { $in: statuses };
  const [data, total] = await Promise.all([
    Waitlist.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Waitlist.countDocuments(filter),
  ]);
  return { data, total };
}

// 1-based place in the queue of a WAITING entry.
async function queuePosition(entry) {
  const ahead = await Waitlist.countDocuments({ schedule_id: entry.schedule_id, status: STATUS.WAITING, id: { $lt: entry.id } });
  return ahead + 1;
}

async function countWaiting(scheduleId) {
  return Waitlist.countDocuments({ schedule_id: Number(scheduleId), status: STATUS.WAITING });
}

async function findWaitingAccountIds(scheduleId) {
  return Waitlist.distinct('account_id', { schedule_id: Number(scheduleId), status: STATUS.WAITING });
}

async function hasActiveEntries(scheduleId) {
  return Boolean(await Waitlist.exists({ schedule_id: Number(scheduleId), status: { $in: ACTIVE_STATUSES } }));
}

async function findActiveScheduleIds() {
  return Waitlist.distinct('schedule_id', { status: { $in: ACTIVE_STATUSES } });
}

async function findHead(scheduleId) {
  return Waitlist.findOne({ schedule_id: Number(scheduleId), status: STATUS.WAITING }).sort({ id: 1 });
}

async function findByStatus(scheduleId, statuses) {
  return Waitlist.find({ schedule_id: Number(scheduleId), status: { $in: statuses } }).sort({ id: 1 });
}

// --- transitions --------------------------------------------------------------------------------
// Each one is conditional on the state it leaves, so whoever loses a race gets null and moves on.

async function markNotified(id, { tickets, now, expiresAt }) {
  return Waitlist.findOneAndUpdate(
    { id: Number(id), status: STATUS.WAITING },
    {
      $set: {
        status: STATUS.NOTIFIED,
        notified_at: now,
        expires_at: expiresAt,
        offered_ticket_ids: tickets.map((t) => t.id),
        offered_seat_codes: tickets.map((t) => t.seat_code),
      },
    },
    { new: true },
  );
}

async function markBooked(filter, { bookingId, now }) {
  return Waitlist.findOneAndUpdate(
    { ...filter, status: { $in: ACTIVE_STATUSES } },
    { $set: { status: STATUS.BOOKED, booking_id: bookingId, booked_at: now } },
    { new: true },
  );
}

async function markBookedById(id, { bookingId, now }) {
  return markBooked({ id: Number(id) }, { bookingId, now });
}

async function markBookedForAccount(scheduleId, accountId, { bookingId, now }) {
  return markBooked({ schedule_id: Number(scheduleId), account_id: Number(accountId) }, { bookingId, now });
}

async function expireOffer(id, now) {
  return Waitlist.findOneAndUpdate(
    { id: Number(id), status: STATUS.NOTIFIED, expires_at: { $lte: now } },
    { $set: { status: STATUS.EXPIRED, expired_at: now, close_reason: CLOSE_REASON.OFFER_EXPIRED } },
    { new: true },
  );
}

async function closeEntry(id, { status, reason, now }) {
  const stamp = status === STATUS.EXPIRED ? 'expired_at' : 'cancelled_at';
  return Waitlist.findOneAndUpdate(
    { id: Number(id), status: { $in: ACTIVE_STATUSES } },
    { $set: { status, close_reason: reason, [stamp]: now } },
    { new: true },
  );
}

async function cancelForAccount(id, accountId, now) {
  return Waitlist.findOneAndUpdate(
    { id: Number(id), account_id: Number(accountId), status: { $in: ACTIVE_STATUSES } },
    { $set: { status: STATUS.CANCELLED, cancelled_at: now, close_reason: CLOSE_REASON.CUSTOMER_CANCELLED } },
    { new: true },
  );
}

// --- seats --------------------------------------------------------------------------------------

async function findDisabledSeatCodes(roomId) {
  return Seat.distinct('seat_code', { room_id: Number(roomId), status: 'DISABLED' });
}

// A lapsed hold (or the TIMEOUT hop) is as good as free: the next sweep hands it back.
async function countSeats(scheduleId, { excludeSeatCodes = [], now = new Date() } = {}) {
  const base = { schedule_id: Number(scheduleId), seat_code: { $nin: excludeSeatCodes } };
  const [total, available] = await Promise.all([
    Ticket.countDocuments(base),
    Ticket.countDocuments({
      ...base,
      $or: [
        { status: Ticket.STATUS.AVAILABLE },
        { status: Ticket.STATUS.TIMEOUT },
        { status: Ticket.STATUS.HELD, held_until: { $lt: now } },
      ],
    }),
  ]);
  return { total, available };
}

// One seat per atomic AVAILABLE -> HELD flip, so a seat can only ever be won by one claimant — a
// customer at the seat map, another waitlist run, the box office.
async function claimSeats({ scheduleId, accountId, count, until, excludeSeatCodes = [] }) {
  const claimed = [];
  while (claimed.length < count) {
    const ticket = await Ticket.findOneAndUpdate(
      { schedule_id: Number(scheduleId), status: Ticket.STATUS.AVAILABLE, seat_code: { $nin: excludeSeatCodes } },
      { $set: { status: Ticket.STATUS.HELD, held_by: Number(accountId), held_until: until } },
      { sort: { seat_index: 1 }, new: true },
    );
    if (!ticket) break;
    claimed.push(ticket);
  }
  return claimed;
}

// Gives back the seats in `ticketIds` that are still this customer's hold — never one they have
// since paid for, nor one another customer holds now.
async function releaseSeats(ticketIds, accountId, { exceptTicketIds = [] } = {}) {
  const released = [];
  for (const id of ticketIds) {
    if (exceptTicketIds.includes(id)) continue;
    const ticket = await Ticket.findOneAndUpdate(
      { id, status: Ticket.STATUS.HELD, held_by: Number(accountId) },
      { $set: { status: Ticket.STATUS.AVAILABLE, held_by: null, held_until: null } },
      { new: true },
    );
    if (ticket) released.push(ticket);
  }
  broadcastSeatUpdate(released, 'AVAILABLE');
  return released;
}

// An offer whose seats slipped out of the customer's hands (a failed payment, a deselect at the seat
// map) gets them back for what is left of its window, if nobody else took them meanwhile.
async function reholdOffer(entry) {
  const reheld = [];
  for (const id of entry.offered_ticket_ids) {
    const ticket = await Ticket.findOneAndUpdate(
      { id, status: Ticket.STATUS.AVAILABLE },
      { $set: { status: Ticket.STATUS.HELD, held_by: entry.account_id, held_until: entry.expires_at } },
      { new: true },
    );
    if (ticket) reheld.push(ticket);
  }
  broadcastSeatUpdate(reheld, 'HELD');
  return reheld;
}

// --- the customer's bookings on the showtime ----------------------------------------------------

async function findPaidBookingSince(entry) {
  return Booking.findOne({
    account_id: entry.account_id,
    schedule_id: entry.schedule_id,
    status: { $in: [Booking.STATUS.PAID, Booking.STATUS.COMPLETED] },
    paid_at: { $gte: entry.notified_at || entry.createdAt },
  }).sort({ id: -1 });
}

// Ticket ids of a checkout the customer has started and not yet finished (or let lapse).
async function findCheckoutTicketIds(entry, now) {
  const pending = await Booking.find(
    {
      account_id: entry.account_id,
      schedule_id: entry.schedule_id,
      status: Booking.STATUS.PENDING,
      expires_at: { $gt: now },
    },
    { ticket_ids: 1 },
  );
  return pending.flatMap((b) => b.ticket_ids);
}

// --- per-showtime lease -------------------------------------------------------------------------

async function acquireLock(scheduleId, owner) {
  const now = Date.now();
  try {
    const lock = await WaitlistLock.findOneAndUpdate(
      { schedule_id: Number(scheduleId), $or: [{ owner: null }, { locked_until: { $lte: new Date(now) } }] },
      { $set: { owner, locked_until: new Date(now + LOCK_LEASE_MS), rerun: false } },
      { upsert: true, new: true },
    );
    return lock.owner === owner;
  } catch (err) {
    // The upsert collided with a live lease on the unique schedule_id: someone else holds it.
    if (err.code === 11000) return false;
    throw err;
  }
}

// Asks the current holder to go round once more. False when there is no live holder to ask.
async function requestRerun(scheduleId) {
  const result = await WaitlistLock.updateOne(
    { schedule_id: Number(scheduleId), owner: { $ne: null }, locked_until: { $gt: new Date() } },
    { $set: { rerun: true } },
  );
  return result.matchedCount > 0;
}

// 'released' | 'rerun' (someone asked for another pass; the lease is renewed) | 'lost' (it ran out).
async function releaseLock(scheduleId, owner) {
  const released = await WaitlistLock.findOneAndUpdate(
    { schedule_id: Number(scheduleId), owner, rerun: false },
    { $set: { owner: null, locked_until: null } },
  );
  if (released) return 'released';
  const renewed = await WaitlistLock.findOneAndUpdate(
    { schedule_id: Number(scheduleId), owner, rerun: true },
    { $set: { rerun: false, locked_until: new Date(Date.now() + LOCK_LEASE_MS) } },
  );
  return renewed ? 'rerun' : 'lost';
}

async function abandonLock(scheduleId, owner) {
  await WaitlistLock.updateOne({ schedule_id: Number(scheduleId), owner }, { $set: { owner: null, locked_until: null } });
}

module.exports = {
  LOCK_LEASE_MS,
  createEntry,
  findActiveForAccount,
  findByIdForAccount,
  findForAccount,
  queuePosition,
  countWaiting,
  findWaitingAccountIds,
  hasActiveEntries,
  findActiveScheduleIds,
  findHead,
  findByStatus,
  markNotified,
  markBookedById,
  markBookedForAccount,
  expireOffer,
  closeEntry,
  cancelForAccount,
  findDisabledSeatCodes,
  countSeats,
  claimSeats,
  releaseSeats,
  reholdOffer,
  findPaidBookingSince,
  findCheckoutTicketIds,
  acquireLock,
  requestRerun,
  releaseLock,
  abandonLock,
};
