const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const boxOfficeRepository = require('./boxOffice.repository');
const Ticket = require('../models/Ticket');
const Account = require('../models/Account');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('boxOffice.repository', () => {
  describe('verifyTicketsLockedByEmployee', () => {
    it('accepts a ticket HELD by the given employee on the given schedule', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });
      const { invalid } = await boxOfficeRepository.verifyTicketsLockedByEmployee({
        scheduleId: 1,
        ticketIds: [1],
        employeeAccountId: 7,
      });
      expect(invalid).toEqual([]);
    });

    it('rejects an AVAILABLE seat that was never locked', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
      const { invalid } = await boxOfficeRepository.verifyTicketsLockedByEmployee({
        scheduleId: 1,
        ticketIds: [1],
        employeeAccountId: 7,
      });
      expect(invalid).toEqual([1]);
    });

    it('rejects a seat that is already BOOKED', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
      const { invalid } = await boxOfficeRepository.verifyTicketsLockedByEmployee({
        scheduleId: 1,
        ticketIds: [1],
        employeeAccountId: 7,
      });
      expect(invalid).toEqual([1]);
    });

    it('rejects a seat HELD by a different employee', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 99 });
      const { invalid } = await boxOfficeRepository.verifyTicketsLockedByEmployee({
        scheduleId: 1,
        ticketIds: [1],
        employeeAccountId: 7,
      });
      expect(invalid).toEqual([1]);
    });

    it('rejects a ticket id that does not exist', async () => {
      const { invalid } = await boxOfficeRepository.verifyTicketsLockedByEmployee({
        scheduleId: 1,
        ticketIds: [999],
        employeeAccountId: 7,
      });
      expect(invalid).toEqual([999]);
    });
  });

  describe('sell', () => {
    it('sells a locked ticket, marking it BOOKED and the booking/payment PAID', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });

      const result = await boxOfficeRepository.sell({
        ticketIds: [1],
        comboIds: [],
        discountAmount: 0,
        seatTotal: 100000,
        comboTotal: 0,
        totalPrice: 100000,
        accountId: 1,
        employeeId: 7,
        branchId: 5,
        method: 'CASH',
      });

      expect(result.skipped).toBeFalsy();
      expect(result.alreadyProcessed).toBeFalsy();
      expect(result.code).toMatch(/^POS-\d+$/);

      const ticket = await Ticket.findOne({ id: 1 });
      expect(ticket.status).toBe(0);

      const booking = await Booking.findOne({ id: result.bookingId });
      expect(booking.status).toBe('PAID');

      const payment = await Payment.findOne({ code: result.code });
      expect(payment.status).toBe('PAID');
      expect(payment.type).toBe('COUNTER');
      expect(payment.method).toBe('CASH');
      expect(payment.amount).toBe(100000);
      expect(payment.branch_id).toBe(5);

      const invoice = await Invoice.findOne({ ticket_id: 1 });
      expect(invoice.created_by).toBe(7);
    });

    it('supports CARD and QR_PAYMENT methods', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });

      const result = await boxOfficeRepository.sell({
        ticketIds: [1],
        comboIds: [],
        discountAmount: 0,
        seatTotal: 50000,
        comboTotal: 0,
        totalPrice: 50000,
        accountId: 1,
        employeeId: 7,
        branchId: 5,
        method: 'QR_PAYMENT',
      });

      const payment = await Payment.findOne({ code: result.code });
      expect(payment.method).toBe('QR_PAYMENT');
    });

    it('is idempotent on idempotencyKey — a retry returns the original sale without a second Payment/Booking', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7 });

      const first = await boxOfficeRepository.sell({
        ticketIds: [1],
        comboIds: [],
        discountAmount: 0,
        seatTotal: 100000,
        comboTotal: 0,
        totalPrice: 100000,
        accountId: 1,
        employeeId: 7,
        branchId: 5,
        method: 'CASH',
        idempotencyKey: 'idem-1',
      });

      const second = await boxOfficeRepository.sell({
        ticketIds: [1],
        comboIds: [],
        discountAmount: 0,
        seatTotal: 100000,
        comboTotal: 0,
        totalPrice: 100000,
        accountId: 1,
        employeeId: 7,
        branchId: 5,
        method: 'CASH',
        idempotencyKey: 'idem-1',
      });

      expect(second.alreadyProcessed).toBe(true);
      expect(second.bookingId).toBe(first.bookingId);
      expect(second.code).toBe(first.code);
      expect(await Payment.countDocuments({})).toBe(1);
      expect(await Booking.countDocuments({})).toBe(1);
      expect(await Invoice.countDocuments({})).toBe(1);
    });
  });
});
