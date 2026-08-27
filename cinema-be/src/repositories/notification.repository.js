const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Movie = require('../models/Movie');
const Branch = require('../models/Branch');
const Invoice = require('../models/Invoice');
const nextId = require('../utils/nextId');

// Ticket 25 — persistence for the notification system. `create` is the single write path for
// new notifications; every other export either reads the caller's history or advances a row's
// delivery state for the retry sweep.

// Creates the notification row. If `dedupeKey` collides with an existing row (the unique sparse
// index fires an E11000), this returns `null` instead of throwing — that is the "no duplicate
// notification" guarantee, surfaced to the service as "nothing to deliver".
async function create({
  accountId,
  type,
  title,
  body = '',
  data = null,
  channels,
  dedupeKey = null,
  status = Notification.STATUS.PENDING,
  maxAttempts = Notification.DEFAULT_MAX_ATTEMPTS,
}) {
  try {
    const doc = {
      id: await nextId('notification'),
      account_id: accountId,
      type,
      title,
      body,
      data,
      channels: channels && channels.length ? channels : [Notification.CHANNEL.IN_APP],
      status,
      max_attempts: maxAttempts,
    };
    // Only set the key when we actually have one — an absent (not null) field keeps the sparse
    // unique index from treating every keyless row as a collision.
    if (dedupeKey) doc.dedupe_key = dedupeKey;
    return await Notification.create(doc);
  } catch (err) {
    if (err && err.code === 11000) return null;
    throw err;
  }
}

async function findById(id) {
  return Notification.findOne({ id: Number(id) });
}

// The caller's own history, newest first. `unread` limits to not-yet-read rows; `status` filters
// by delivery state (rarely used by the UI, handy for diagnostics).
async function findForAccount(accountId, { unread, status, skip = 0, limit = 20 } = {}) {
  const filter = { account_id: Number(accountId) };
  if (unread === true) filter.read_at = null;
  if (status) filter.status = status;
  const [data, total] = await Promise.all([
    Notification.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
  ]);
  return { data, total };
}

async function countUnread(accountId) {
  return Notification.countDocuments({ account_id: Number(accountId), read_at: null });
}

// Marks one row read, scoped to its owner so a caller can never touch someone else's row.
// Returns the updated doc, or null if it does not exist / is not theirs.
async function markRead(id, accountId) {
  return Notification.findOneAndUpdate(
    { id: Number(id), account_id: Number(accountId) },
    { $set: { read_at: new Date() } },
    { new: true },
  );
}

async function markAllRead(accountId) {
  const res = await Notification.updateMany(
    { account_id: Number(accountId), read_at: null },
    { $set: { read_at: new Date() } },
  );
  return res.modifiedCount ?? res.nModified ?? 0;
}

// --- delivery state (used by the service + retry sweep) --------------------

async function markSent(id) {
  return Notification.findOneAndUpdate(
    { id: Number(id) },
    { $set: { status: Notification.STATUS.SENT, sent_at: new Date(), next_attempt_at: null, last_error: null } },
    { new: true },
  );
}

// Records a failed delivery attempt. The service decides whether another retry is due
// (`nextAttemptAt` set) or the row has exhausted its budget (`nextAttemptAt` null → terminal).
async function markFailed(id, { error, attempts, nextAttemptAt = null }) {
  return Notification.findOneAndUpdate(
    { id: Number(id) },
    {
      $set: {
        status: Notification.STATUS.FAILED,
        attempts,
        last_error: error ? String(error).slice(0, 500) : null,
        next_attempt_at: nextAttemptAt,
      },
    },
    { new: true },
  );
}

// Rows whose delivery failed but are still within their retry budget and whose backoff window
// has elapsed.
async function findRetryable(now = new Date(), limit = 50) {
  return Notification.find({
    status: Notification.STATUS.FAILED,
    next_attempt_at: { $ne: null, $lte: now },
    $expr: { $lt: ['$attempts', '$max_attempts'] },
  })
    .sort({ next_attempt_at: 1 })
    .limit(limit);
}

// Builds the safe, display-only context block attached to every booking-related notification.
// Deliberately returns only movie / branch / room / showtime / seat / booking code / ticket
// code — never anything sensitive. Missing joins degrade to a partial object, never an error.
async function loadContext(bookingId) {
  if (!bookingId) return {};
  const booking = await Booking.findOne({ id: Number(bookingId) });
  if (!booking) return {};

  const [schedule, tickets, invoices] = await Promise.all([
    Schedule.findOne({ id: booking.schedule_id }),
    Ticket.find({ id: { $in: booking.ticket_ids || [] } }),
    Invoice.find({ booking_id: booking.id }),
  ]);

  const [movie, room, branch] = await Promise.all([
    schedule ? Movie.findOne({ id: schedule.movie_id }) : null,
    schedule ? Room.findOne({ id: schedule.room_id }) : null,
    Branch.findOne({ id: booking.branch_id }),
  ]);

  const ctx = {
    bookingCode: booking.code,
    seats: tickets.map((tk) => tk.seat_code).filter(Boolean),
    ticketCodes: invoices.map((inv) => inv.qr_token).filter(Boolean),
  };
  if (movie) ctx.movie = movie.name;
  if (branch) ctx.branch = branch.name;
  if (room) ctx.room = room.name;
  if (schedule) {
    ctx.showtime = {
      date: schedule.movie_date,
      time_begin: schedule.time_begin,
      time_end: schedule.time_end,
    };
  }
  return ctx;
}

module.exports = {
  create,
  findById,
  findForAccount,
  countUnread,
  markRead,
  markAllRead,
  markSent,
  markFailed,
  findRetryable,
  loadContext,
};
