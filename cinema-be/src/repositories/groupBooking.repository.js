const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const bookingRepository = require('./booking.repository');
const nextId = require('../utils/nextId');
const { generateQrToken } = require('../utils/qrToken');
const { runInTransaction } = require('../utils/withTransaction');

const GROUP = Booking.TYPE.GROUP;

// Aborts a unit of work: rolls the transaction back, or triggers the compensation.
class GroupAbort extends Error {
  constructor(reason, ticketIds = []) {
    super(reason);
    this.name = 'GroupAbort';
    this.reason = reason;
    this.ticketIds = ticketIds;
  }
}

const isDuplicateKey = (err, field) => err && err.code === 11000 && (!field || JSON.stringify(err.keyPattern || {}).includes(field));

async function findByCode(code) {
  return Booking.findOne({ code: String(code), booking_type: GROUP });
}

async function findByIdempotencyKey(key) {
  if (!key) return null;
  return Booking.findOne({ idempotency_key: String(key) });
}

async function isGroupBookingCode(code) {
  if (!code) return false;
  return Boolean(await Booking.exists({ code: String(code), booking_type: GROUP }));
}

// Returns { booking, payment } | { conflict: [ticketId...] } | { duplicateKey: true }.
// Seats are claimed in ascending id order so two overlapping checkouts contend on the same seat first.
async function createPending({
  code,
  accountId,
  schedule,
  ticketIds,
  comboIds,
  pricing,
  group,
  expiresAt,
  idempotencyKey = null,
  createdBy = null,
}) {
  const sortedIds = [...ticketIds].map(Number).sort((a, b) => a - b);
  const bookingId = await nextId('booking');
  const paymentId = await nextId('payment');

  try {
    return await runInTransaction(async (session) => {
      const doc = {
        id: bookingId,
        code,
        account_id: Number(accountId),
        schedule_id: schedule.id,
        branch_id: schedule.cinema_id,
        ticket_ids: sortedIds,
        combo_ids: comboIds.map(Number),
        voucher_code: pricing.voucherCode,
        promotion_code: pricing.promotionCode,
        discount_amount: pricing.discountAmount,
        seat_total: pricing.seatTotal,
        combo_total: pricing.comboTotal,
        total_price: pricing.totalPrice,
        status: Booking.STATUS.PENDING,
        expires_at: expiresAt,
        created_by: createdBy,
        booking_type: GROUP,
        group,
      };
      if (idempotencyKey) doc.idempotency_key = String(idempotencyKey);
      // The booking row goes first: with a key, it is the gate a concurrent duplicate request trips on.
      const [booking] = await Booking.create([doc], { session });

      const claimed = [];
      try {
        const lost = [];
        for (const ticketId of sortedIds) {
          const pre = await bookingRepository.claimSeatForGroup({
            ticketId,
            scheduleId: schedule.id,
            accountId: Number(accountId),
            bookingCode: code,
            until: expiresAt,
            session,
          });
          if (pre) claimed.push(pre);
          else lost.push(ticketId);
        }
        if (lost.length > 0) throw new GroupAbort('SEAT_UNAVAILABLE', lost);

        const [payment] = await Payment.create(
          [
            {
              id: paymentId,
              code,
              booking_id: booking.id,
              account_id: Number(accountId),
              branch_id: schedule.cinema_id,
              type: Payment.TYPE.ONLINE,
              method: Payment.METHOD.MOMO,
              amount: pricing.totalPrice,
              status: Payment.STATUS.PENDING,
              created_by: createdBy,
            },
          ],
          { session },
        );
        return { booking, payment, claimed };
      } catch (err) {
        if (!session) {
          try {
            await bookingRepository.restoreGroupClaims(claimed, code);
            await Booking.deleteOne({ id: booking.id, status: Booking.STATUS.PENDING });
          } catch (compensationError) {
            console.error('[groupBooking] checkout compensation failed', code, compensationError.message);
          }
        }
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof GroupAbort) return { conflict: err.ticketIds };
    if (idempotencyKey && isDuplicateKey(err, 'idempotency_key')) return { duplicateKey: true };
    throw err;
  }
}

// Everything that has to be true of a paid group booking, written as one unit. Returns:
//   { issued: true, booking, invoices }  this call issued the tickets (the only one that ever does)
//   { alreadyPaid: true, booking }        an earlier/concurrent confirmation already did
//   { notPayable: true, booking }         cancelled before the money arrived — refund it
//   { seatsLost: [ticketId], booking }    a seat went to someone else after the hold lapsed — refund it
async function finalizePaid(code) {
  let outcome;
  try {
    outcome = await runInTransaction(async (session) => {
      const booking = await Booking.findOneAndUpdate(
        { code, booking_type: GROUP, status: { $in: [Booking.STATUS.PENDING, Booking.STATUS.EXPIRED] } },
        { $set: { status: Booking.STATUS.PAID, paid_at: new Date() } },
        { new: true, session },
      );
      if (!booking) return { gate: false };

      const booked = [];
      const invoices = [];
      try {
        for (const ticketId of booking.ticket_ids) {
          const pre = await bookingRepository.bookSeatForGroup({ ticketId, bookingCode: code, session });
          if (!pre) throw new GroupAbort('SEAT_LOST', [ticketId]);
          booked.push(pre);
        }

        // One ticket per seat; the total is spread evenly with the remainder on the first, exactly as a
        // standard booking's invoices are (finalizeMomoOrder).
        const count = booking.ticket_ids.length;
        const base = Math.floor(booking.total_price / count);
        const remainder = booking.total_price - base * count;
        for (let index = 0; index < count; index += 1) {
          const ticketId = booking.ticket_ids[index];
          const isFirst = index === 0;
          const id = await nextId('invoice');
          const [invoice] = await Invoice.create(
            [
              {
                id,
                booking_id: booking.id,
                ticket_id: ticketId,
                account_id: booking.account_id,
                code,
                total_price: base + (isFirst ? remainder : 0),
                combo_ids: booking.combo_ids,
                voucher_code: isFirst ? booking.voucher_code : null,
                promotion_code: isFirst ? booking.promotion_code : null,
                discount_amount: isFirst ? booking.discount_amount : 0,
                status: 1,
                created_by: booking.created_by,
                qr_token: generateQrToken(),
                ticket_status: Invoice.TICKET_STATUS.ISSUED,
                issued_at: new Date(),
                issue_key: `${code}:${ticketId}`,
              },
            ],
            { session },
          );
          invoices.push(invoice);
        }
      } catch (err) {
        if (!session) {
          try {
            await Invoice.deleteMany({ id: { $in: invoices.map((i) => i.id) } });
            await bookingRepository.restoreBookedGroupSeats(booked);
            await Booking.updateOne(
              { id: booking.id, status: Booking.STATUS.PAID },
              { $set: { status: Booking.STATUS.PENDING, paid_at: null } },
            );
          } catch (compensationError) {
            console.error('[groupBooking] finalize compensation failed', code, compensationError.message);
          }
        }
        throw err;
      }
      return { gate: true, booking, invoices };
    });
  } catch (err) {
    if (!(err instanceof GroupAbort)) throw err;
    // Rolled back / compensated: the booking is PENDING (or EXPIRED) again and its remaining seats are
    // still bound to it. It cannot be honoured, so it is cancelled and those seats freed.
    await bookingRepository.cancelPendingGroupBooking(code, { reason: 'Seats no longer available at payment' });
    await Booking.updateOne(
      { code, booking_type: GROUP, status: Booking.STATUS.EXPIRED },
      { $set: { status: Booking.STATUS.CANCELLED, cancelled_at: new Date(), cancel_reason: 'Seats no longer available at payment' } },
    );
    return { seatsLost: err.ticketIds, booking: await findByCode(code) };
  }

  if (outcome.gate) return { issued: true, booking: outcome.booking, invoices: outcome.invoices };
  const booking = await findByCode(code);
  if (booking && [Booking.STATUS.PAID, Booking.STATUS.COMPLETED].includes(booking.status)) {
    return { alreadyPaid: true, booking };
  }
  return { notPayable: true, booking };
}

async function findInvoices(bookingId) {
  return Invoice.find({ booking_id: Number(bookingId) }).sort({ id: 1 });
}

module.exports = {
  GroupAbort,
  findByCode,
  findByIdempotencyKey,
  isGroupBookingCode,
  createPending,
  finalizePaid,
  findInvoices,
};
