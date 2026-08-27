const Notification = require('../models/Notification');
const Account = require('../models/Account');
const notificationRepository = require('../repositories/notification.repository');
const { emitToAccount } = require('../utils/socket');
const { sendNotificationEmail } = require('../utils/mailer');

const { EVENT, STATUS, CHANNEL } = Notification;

// Ticket 25 — the one entry point business code calls to raise a notification. Every rule from
// the ticket lives here:
//   - never throws            -> `notify` wraps everything; a notification failure can't break
//                                the booking / payment / refund flow that triggered it.
//   - no duplicate            -> a deterministic `dedupe_key`; the repo drops the collision.
//   - retry on failure        -> a failed EMAIL send is marked FAILED with an exponential-backoff
//                                `next_attempt_at`; jobs/notificationRetry.job re-runs delivery.
//   - no sensitive data       -> only the safe context from notificationRepository.loadContext
//                                plus caller-supplied display fields ever reach `data`.

const BASE_BACKOFF_MS = 60 * 1000; // 1 min
const MAX_BACKOFF_MS = 60 * 60 * 1000; // 1 hour

function backoffFor(attempts) {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

// Human-readable fallback text. The frontend localises off `type` + `data`; this is what an
// email (or a non-localised client) shows.
function buildContent(event, ctx = {}) {
  const movie = ctx.movie ? `"${ctx.movie}"` : 'your movie';
  const when = ctx.showtime ? ` on ${ctx.showtime.date} at ${ctx.showtime.time_begin}` : '';
  const at = ctx.branch ? ` at ${ctx.branch}` : '';
  const code = ctx.bookingCode ? ` (booking ${ctx.bookingCode})` : '';
  switch (event) {
    case EVENT.BOOKING_CREATED:
      return { title: 'Booking created', body: `We received your booking for ${movie}${when}${at}${code}.` };
    case EVENT.PAYMENT_SUCCESS:
      return { title: 'Payment successful', body: `Your payment for ${movie}${when} was successful${code}.` };
    case EVENT.PAYMENT_FAILED:
      return { title: 'Payment failed', body: `Your payment for ${movie}${when} did not go through${code}. Please try again.` };
    case EVENT.TICKET_ISSUED:
      return { title: 'Ticket issued', body: `Your ticket for ${movie}${when}${at} is ready${code}.` };
    case EVENT.BOOKING_CANCELLED:
      return { title: 'Booking cancelled', body: `Your booking for ${movie}${when} has been cancelled${code}.` };
    case EVENT.REFUND_COMPLETED:
      return { title: 'Refund completed', body: `Your refund for ${movie}${when} has been completed${code}.` };
    case EVENT.SHOWTIME_CANCELLED:
      return { title: 'Showtime cancelled', body: `The showtime for ${movie}${when}${at} has been cancelled${code}.` };
    case EVENT.SHOWTIME_CHANGED:
      return { title: 'Showtime changed', body: `The showtime for ${movie}${at} has been changed${code}. Please review your booking.` };
    default:
      return { title: 'Notification', body: '' };
  }
}

function publicPayload(notification) {
  // toJSON already strips delivery-machinery + `_id`; safe to push straight to the socket.
  return notification.toJSON();
}

// Attempts the notification's channels. IN_APP is satisfied the moment the row exists (plus a
// best-effort realtime nudge); EMAIL is the fallible part that drives retry. Never throws.
async function attemptDelivery(notification) {
  try {
    // Best-effort realtime hint; emitToAccount is a no-op when nobody is connected and never throws.
    emitToAccount(notification.account_id, 'notification:new', publicPayload(notification));

    if ((notification.channels || []).includes(CHANNEL.EMAIL)) {
      const account = await Account.findOne({ id: notification.account_id });
      if (account && account.email) {
        await sendNotificationEmail(account.email, {
          subject: `Cinema Booking - ${notification.title}`,
          text: notification.body,
        });
      }
    }

    await notificationRepository.markSent(notification.id);
    return { ok: true };
  } catch (err) {
    const attempts = (notification.attempts || 0) + 1;
    const exhausted = attempts >= (notification.max_attempts || Notification.DEFAULT_MAX_ATTEMPTS);
    await notificationRepository.markFailed(notification.id, {
      error: err.message,
      attempts,
      nextAttemptAt: exhausted ? null : new Date(Date.now() + backoffFor(attempts)),
    });
    if (exhausted) {
      console.error('[notification] giving up after', attempts, 'attempts', notification.type, notification.id, err.message);
    }
    return { ok: false, exhausted };
  }
}

// The single call site for business code. Resolves display context, writes the (deduped) row,
// then tries to deliver it. Returns the created notification, or null when it was a duplicate
// or when anything went wrong (the caller neither needs nor should act on the result).
async function notify({ event, accountId, bookingId = null, data = {}, channels, dedupeKey } = {}) {
  try {
    if (!event || !accountId) return null;

    const ctx = { ...(await notificationRepository.loadContext(bookingId)), ...(data || {}) };
    const { title, body } = buildContent(event, ctx);
    const key = dedupeKey || `${event}:${accountId}:${bookingId ?? ctx.ref ?? 'na'}`;

    const notification = await notificationRepository.create({
      accountId,
      type: event,
      title,
      body,
      data: ctx,
      channels,
      dedupeKey: key,
    });
    if (!notification) return null; // duplicate — already raised once

    await attemptDelivery(notification);
    return notification;
  } catch (err) {
    // A notification must never break the operation that triggered it.
    console.error('[notification] notify failed', event, err.message);
    return null;
  }
}

// Retry sweep entry point (jobs/notificationRetry.job). Re-attempts delivery for every failed
// row whose backoff window has elapsed and whose attempt budget is not spent. Never throws.
async function retryFailed({ now = new Date(), limit = 50 } = {}) {
  try {
    const rows = await notificationRepository.findRetryable(now, limit);
    for (const row of rows) {
      await attemptDelivery(row);
    }
    return rows.length;
  } catch (err) {
    console.error('[notification] retry sweep failed', err.message);
    return 0;
  }
}

module.exports = {
  notify,
  retryFailed,
  attemptDelivery,
  buildContent,
  backoffFor,
  EVENT,
  STATUS,
  CHANNEL,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
};
