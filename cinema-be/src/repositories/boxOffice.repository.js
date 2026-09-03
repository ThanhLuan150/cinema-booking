const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const bookingRepository = require('./booking.repository');
const paymentRepository = require('./payment.repository');
const nextId = require('../utils/nextId');

async function verifyTicketsLockedByEmployee({ scheduleId, ticketIds, employeeAccountId }) {
  const tickets = await Ticket.find({ id: { $in: ticketIds.map(Number) } });
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  const invalid = [];
  for (const id of ticketIds) {
    const ticket = ticketById.get(Number(id));
    const isLocked =
      ticket &&
      ticket.schedule_id === Number(scheduleId) &&
      ticket.status === Ticket.STATUS.HELD &&
      ticket.held_by === employeeAccountId;
    if (!isLocked) invalid.push(id);
  }
  return { tickets, invalid };
}

async function sell({
  ticketIds,
  comboIds = [],
  voucherCode = null,
  promotionCode = null,
  discountAmount,
  seatTotal,
  comboTotal,
  totalPrice,
  accountId,
  employeeId,
  branchId,
  method,
  idempotencyKey = null,
}) {
  if (idempotencyKey) {
    const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existing) return { alreadyProcessed: true, bookingId: existing.booking_id, code: existing.code };
  }

  const orderId = `POS-${await nextId('boxOfficeOrder')}`;
  const result = await bookingRepository.finalizeMomoOrder(
    orderId,
    {
      ticketIds,
      comboIds,
      voucherCode,
      promotionCode,
      discountAmount,
      totalPrice,
      accountId,
      createdBy: employeeId,
      seatTotal,
      comboTotal,
    },
    { comboPaymentMethod: method },
  );

  if (result.skipped || result.alreadyProcessed) {
    return { ...result, code: orderId };
  }

  await paymentRepository.createPayment({
    code: orderId,
    bookingId: result.bookingId,
    accountId,
    branchId,
    type: Payment.TYPE.COUNTER,
    method,
    amount: totalPrice,
    status: Payment.STATUS.PAID,
    idempotencyKey,
    createdBy: employeeId,
  });

  return { ...result, code: orderId };
}

module.exports = { verifyTicketsLockedByEmployee, sell };
