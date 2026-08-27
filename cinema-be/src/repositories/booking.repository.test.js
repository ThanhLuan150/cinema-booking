jest.mock('../utils/mailer', () => ({ sendInvoiceEmail: jest.fn().mockResolvedValue({}) }));
jest.mock('../utils/socket', () => ({ emitToOwner: jest.fn() }));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const bookingRepository = require('./booking.repository');
const mailer = require('../utils/mailer');
const socket = require('../utils/socket');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const Account = require('../models/Account');
const Voucher = require('../models/Voucher');
const Promotion = require('../models/Promotion');
const PromotionUsage = require('../models/PromotionUsage');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Movie = require('../models/Movie');
const Combo = require('../models/Combo');
const ComboOrder = require('../models/ComboOrder');
const PointsTransaction = require('../models/PointsTransaction');

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

describe('booking.repository', () => {
  it('findScheduleByMovieDateTime finds an exact match', async () => {
    await Schedule.create({
      id: 1,
      movie_id: 5,
      room_id: 1,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 1,
    });
    const found = await bookingRepository.findScheduleByMovieDateTime({
      movie_id: '5',
      movie_date: '2026-01-01',
      time_begin: '10:00',
    });
    expect(found).not.toBeNull();
  });

  it('findTicketsByScheduleId sorts by seat_index', async () => {
    await Ticket.create([
      { id: 1, schedule_id: 1, seat_index: 1, seat_code: 'A2' },
      { id: 2, schedule_id: 1, seat_index: 0, seat_code: 'A1' },
    ]);
    const result = await bookingRepository.findTicketsByScheduleId('1');
    expect(result.map((t) => t.seat_index)).toEqual([0, 1]);
  });

  it('findUpcomingSchedulesForMovie filters by date >= fromDate', async () => {
    await Schedule.create([
      { id: 1, movie_id: 5, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
      { id: 2, movie_id: 5, room_id: 1, movie_date: '2025-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
    ]);
    const result = await bookingRepository.findUpcomingSchedulesForMovie(5, '2026-01-01');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('findUpcomingSchedulesForMovie excludes cancelled showtimes', async () => {
    await Schedule.create([
      { id: 1, movie_id: 5, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1, status: 'ACTIVE' },
      { id: 2, movie_id: 5, room_id: 1, movie_date: '2026-01-02', time_begin: '10:00', time_end: '12:00', price: 1, status: 'CANCELLED' },
    ]);
    const result = await bookingRepository.findUpcomingSchedulesForMovie(5, '2026-01-01');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('findScheduleByMovieDateTime ignores a cancelled showtime', async () => {
    await Schedule.create({
      id: 1,
      movie_id: 5,
      room_id: 1,
      movie_date: '2026-01-01',
      time_begin: '10:00',
      time_end: '12:00',
      price: 1,
      status: 'CANCELLED',
    });
    const found = await bookingRepository.findScheduleByMovieDateTime({
      movie_id: '5',
      movie_date: '2026-01-01',
      time_begin: '10:00',
    });
    expect(found).toBeNull();
  });

  describe('finalizeMomoOrder', () => {
    async function seedOrder() {
      await Branch.create({ id: 1, company_id: 1, owner_id: 77, name: 'Cinema', code: 'A' });
      await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
      await Schedule.create({
        id: 1,
        movie_id: 1,
        room_id: 1,
        movie_date: '2026-01-01',
        time_begin: '10:00',
        time_end: '12:00',
        price: 1,
      });
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 1 },
      ]);
      await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
    }

    it('is a no-op for a missing accountId or empty ticket list', async () => {
      const result = await bookingRepository.finalizeMomoOrder('ORDER-1', { ticketIds: [] });
      expect(result).toEqual({ alreadyProcessed: false, skipped: true });
      expect(await Invoice.countDocuments()).toBe(0);
    });

    it('creates invoices, marks tickets sold, splits price with remainder on the first ticket', async () => {
      await seedOrder();
      const result = await bookingRepository.finalizeMomoOrder('ORDER-1', {
        ticketIds: [1, 2],
        comboIds: [],
        totalPrice: 100001,
        accountId: 10,
      });

      expect(result).toEqual({ alreadyProcessed: false, bookingId: expect.any(Number) });
      const invoices = await Invoice.find().sort({ ticket_id: 1 });
      expect(invoices).toHaveLength(2);
      expect(invoices[0].total_price + invoices[1].total_price).toBe(100001);
      expect(invoices[0].total_price).toBe(50001);
      expect(invoices[1].total_price).toBe(50000);
      expect(invoices.every((inv) => inv.booking_id === result.bookingId)).toBe(true);
      expect(invoices.every((inv) => inv.ticket_status === 'ISSUED')).toBe(true);
      expect(invoices.every((inv) => inv.issued_at instanceof Date)).toBe(true);
      expect(new Set(invoices.map((inv) => inv.qr_token)).size).toBe(2);
      expect(invoices[0].qr_token).toMatch(/^TCK-/);

      const tickets = await Ticket.find().sort({ id: 1 });
      expect(tickets.every((t) => t.status === 0)).toBe(true);

      expect(mailer.sendInvoiceEmail).toHaveBeenCalledWith('buyer@example.com', expect.objectContaining({
        seats: ['A1', 'A2'],
      }));
      expect(socket.emitToOwner).toHaveBeenCalledWith(77, 'booking:new', expect.objectContaining({ branchId: 1 }));
    });

    it('increments used_count when a voucher code is present', async () => {
      await seedOrder();
      await Voucher.create({ id: 1, code: 'SAVE10', discount_type: 'fixed', discount_value: 1000, used_count: 0 });

      await bookingRepository.finalizeMomoOrder('ORDER-2', {
        ticketIds: [1],
        totalPrice: 90000,
        accountId: 10,
        voucherCode: 'save10',
        discountAmount: 10000,
      });

      const voucher = await Voucher.findOne({ id: 1 });
      expect(voucher.used_count).toBe(1);
      const invoice = await Invoice.findOne({ ticket_id: 1 });
      expect(invoice.voucher_code).toBe('SAVE10');
      expect(invoice.discount_amount).toBe(10000);
    });

    it('records usage when a promotion code is present, and never touches Voucher.used_count', async () => {
      await seedOrder();
      await Promotion.create({
        id: 1,
        code: 'PROMO10',
        name: 'Promo',
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        start_at: new Date(Date.now() - 86400000),
        end_at: new Date(Date.now() + 86400000),
      });

      await bookingRepository.finalizeMomoOrder('ORDER-2B', {
        ticketIds: [1],
        totalPrice: 90000,
        accountId: 10,
        promotionCode: 'promo10',
        discountAmount: 10000,
      });

      const promotion = await Promotion.findOne({ id: 1 });
      expect(promotion.used_count).toBe(1);
      const usage = await PromotionUsage.findOne({ promotion_id: 1, account_id: 10 });
      expect(usage.count).toBe(1);

      const booking = await Booking.findOne({ code: 'ORDER-2B' });
      expect(booking.promotion_code).toBe('PROMO10');
      expect(booking.voucher_code).toBeNull();

      const invoice = await Invoice.findOne({ ticket_id: 1 });
      expect(invoice.promotion_code).toBe('PROMO10');
      expect(invoice.discount_amount).toBe(10000);
    });

    it('is idempotent for a repeated orderId', async () => {
      await seedOrder();
      await bookingRepository.finalizeMomoOrder('ORDER-3', { ticketIds: [1], totalPrice: 1000, accountId: 10 });
      const result = await bookingRepository.finalizeMomoOrder('ORDER-3', { ticketIds: [1], totalPrice: 1000, accountId: 10 });
      expect(result).toEqual({ alreadyProcessed: true });
      expect(await Invoice.countDocuments()).toBe(1);
    });

    it('awards loyalty points to the buyer once the booking is paid', async () => {
      await seedOrder();
      const result = await bookingRepository.finalizeMomoOrder('ORDER-1', {
        ticketIds: [1, 2],
        totalPrice: 100000,
        accountId: 10,
      });

      const buyer = await Account.findOne({ id: 10 });
      expect(buyer.points_balance).toBeGreaterThan(0);
      expect(buyer.lifetime_points).toBe(buyer.points_balance);

      const earnTxs = await PointsTransaction.find({ booking_id: result.bookingId, type: 'EARN' });
      expect(earnTxs).toHaveLength(1);
      expect(earnTxs[0].account_id).toBe(10);
    });

    it('never awards loyalty points twice for a retried orderId (duplicate payment callback)', async () => {
      await seedOrder();
      const first = await bookingRepository.finalizeMomoOrder('ORDER-3', { ticketIds: [1], totalPrice: 100000, accountId: 10 });
      await bookingRepository.finalizeMomoOrder('ORDER-3', { ticketIds: [1], totalPrice: 100000, accountId: 10 });

      const earnTxs = await PointsTransaction.find({ booking_id: first.bookingId, type: 'EARN' });
      expect(earnTxs).toHaveLength(1);
      const buyer = await Account.findOne({ id: 10 });
      expect(buyer.points_balance).toBe(earnTxs[0].points);
    });
  });

  describe('ticket lifecycle transitions', () => {
    it('cancelInvoiceRecord marks the invoice cancelled and its ticket_status CANCELLED', async () => {
      const invoice = await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, status: 1 });
      await bookingRepository.cancelInvoiceRecord(invoice);
      const saved = await Invoice.findOne({ id: 1 });
      expect(saved.status).toBe(0);
      expect(saved.ticket_status).toBe('CANCELLED');
    });

    it('refundInvoiceRecord marks the invoice refunded and its ticket_status REFUNDED', async () => {
      const invoice = await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, status: 1 });
      await bookingRepository.refundInvoiceRecord(invoice);
      const saved = await Invoice.findOne({ id: 1 });
      expect(saved.status).toBe(2);
      expect(saved.ticket_status).toBe('REFUNDED');
    });

    it('checkInInvoiceRecord marks the invoice checked in and its ticket_status USED', async () => {
      await Invoice.create({
        id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, status: 1,
        ticket_status: 'ISSUED',
      });
      const updated = await bookingRepository.checkInInvoiceRecord({ id: 1, accountId: 42, branchId: 7 });
      expect(updated.checked_in).toBe(true);
      expect(updated.ticket_status).toBe('USED');
      expect(updated.checked_in_by).toBe(42);
      expect(updated.checkin_branch_id).toBe(7);
      expect(updated.checked_in_at).toBeInstanceOf(Date);
    });

    it('checkInInvoiceRecord is atomic: a second concurrent check-in on the same ticket loses the race', async () => {
      await Invoice.create({
        id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, status: 1,
        ticket_status: 'ISSUED',
      });
      const [first, second] = await Promise.all([
        bookingRepository.checkInInvoiceRecord({ id: 1, accountId: 1, branchId: 1 }),
        bookingRepository.checkInInvoiceRecord({ id: 1, accountId: 2, branchId: 1 }),
      ]);
      const winners = [first, second].filter(Boolean);
      expect(winners).toHaveLength(1);
    });

    it('checkInInvoiceRecord refuses a ticket that is not ISSUED', async () => {
      await Invoice.create({
        id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, status: 1,
        ticket_status: 'USED', checked_in: true,
      });
      const updated = await bookingRepository.checkInInvoiceRecord({ id: 1, accountId: 1, branchId: 1 });
      expect(updated).toBeNull();
    });

    it('cancelBooking also flips its sibling invoices to CANCELLED ticket_status', async () => {
      const booking = await Booking.create({
        id: 1, code: 'BK-1', account_id: 1, schedule_id: 1, branch_id: 1,
        ticket_ids: [1], total_price: 1, status: 'PAID',
      });
      await Invoice.create({ id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'BK-1', total_price: 1, status: 1 });
      await bookingRepository.cancelBooking(booking);
      expect((await Invoice.findOne({ id: 1 })).ticket_status).toBe('CANCELLED');
    });

    it('applyRefund also flips its sibling invoices to REFUNDED ticket_status', async () => {
      const booking = await Booking.create({
        id: 1, code: 'BK-1', account_id: 1, schedule_id: 1, branch_id: 1,
        ticket_ids: [1], total_price: 1, status: 'PAID',
      });
      await Invoice.create({ id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'BK-1', total_price: 1, status: 1 });
      await bookingRepository.applyRefund(booking);
      expect((await Invoice.findOne({ id: 1 })).ticket_status).toBe('REFUNDED');
    });

    it('applyRefund reverses the booking\'s earned loyalty points', async () => {
      await Account.create({ id: 1, email: 'buyer@example.com', password: 'x', points_balance: 10, lifetime_points: 10 });
      await PointsTransaction.create({
        id: 9001, account_id: 1, type: 'EARN', points: 10, remaining_points: 10, booking_id: 1, balance_after: 10,
      });
      const booking = await Booking.create({
        id: 1, code: 'BK-1', account_id: 1, schedule_id: 1, branch_id: 1,
        ticket_ids: [1], total_price: 1, status: 'PAID',
      });
      await bookingRepository.applyRefund(booking);

      const account = await Account.findOne({ id: 1 });
      expect(account.points_balance).toBe(0);
      expect(account.lifetime_points).toBe(0);
      const reversal = await PointsTransaction.findOne({ booking_id: 1, type: 'REVERSAL' });
      expect(reversal.points).toBe(-10);
    });
  });

  describe('findInvoiceByQrToken', () => {
    it('resolves an invoice by its qr_token', async () => {
      await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, qr_token: 'TCK-abc' });
      const found = await bookingRepository.findInvoiceByQrToken('TCK-abc');
      expect(found?.id).toBe(1);
    });

    it('returns null for an unknown token', async () => {
      expect(await bookingRepository.findInvoiceByQrToken('TCK-nope')).toBeNull();
    });
  });

  describe('ticket views (my-tickets / QR verify)', () => {
    async function seedIssuedTicket({ ticketStatus = 'ISSUED', movieDate = '2026-01-01' } = {}) {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'Cinema', code: 'A', address: '123 St', city: 'HCMC' });
      await Room.create({ id: 1, cinema_id: 1, name: 'R1', type: 'IMAX' });
      await Schedule.create({
        id: 1, movie_id: 1, room_id: 1, movie_date: movieDate, time_begin: '10:00', time_end: '12:00', price: 1,
      });
      await Movie.create({ id: 1, name: 'Movie A', premiere_date: '2026-01-01', avatar: 'a.jpg' });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', seat_type: 1, status: 0 });
      return Invoice.create({
        id: 1, booking_id: 5, ticket_id: 1, account_id: 42, code: 'BK-1', total_price: 100000,
        qr_token: 'TCK-view', ticket_status: ticketStatus, issued_at: new Date('2026-01-01T08:00:00Z'),
      });
    }

    it('findTicketViewsForAccount returns a fully joined ticket view for the account', async () => {
      await seedIssuedTicket();
      const [view] = await bookingRepository.findTicketViewsForAccount(42);
      expect(view).toMatchObject({
        ticket_id: 1,
        booking_id: 5,
        showtime_id: 1,
        movie_id: 1,
        branch_id: 1,
        room_id: 1,
        seat_id: 1,
        seat_code: 'A1',
        status: 'ISSUED',
        qr_token: 'TCK-view',
      });
      expect(view.movie.name).toBe('Movie A');
      expect(view.room.name).toBe('R1');
      expect(view.branch.name).toBe('Cinema');
      expect(view.schedule.movie_date).toBe('2026-01-01');
    });

    it('findTicketViewsForAccount does not return another account\'s tickets', async () => {
      await seedIssuedTicket();
      expect(await bookingRepository.findTicketViewsForAccount(999)).toHaveLength(0);
    });

    it('findTicketViewById resolves a single ticket with its owning invoice', async () => {
      await seedIssuedTicket();
      const result = await bookingRepository.findTicketViewById(1);
      expect(result.view.ticket_id).toBe(1);
      expect(result.invoice.account_id).toBe(42);
    });

    it('findTicketViewById returns null for an unknown id', async () => {
      expect(await bookingRepository.findTicketViewById(999)).toBeNull();
    });

    it('findTicketViewByQrToken resolves a ticket by its scanned QR token', async () => {
      await seedIssuedTicket();
      const result = await bookingRepository.findTicketViewByQrToken('TCK-view');
      expect(result.view.seat_code).toBe('A1');
    });

    it('findTicketViewByQrToken returns null for an unrecognized token', async () => {
      expect(await bookingRepository.findTicketViewByQrToken('TCK-nope')).toBeNull();
    });
  });

  describe('expireIssuedTickets', () => {
    it('flips an ISSUED ticket to EXPIRED once its showtime + runtime has clearly passed', async () => {
      await Schedule.create({
        id: 1, movie_id: 1, room_id: 1, movie_date: '2020-01-01', time_begin: '10:00', time_end: '12:00', price: 1,
      });
      await Movie.create({ id: 1, name: 'Old Movie', premiere_date: '2020-01-01', duration: 120 });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
      await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, ticket_status: 'ISSUED' });

      const count = await bookingRepository.expireIssuedTickets();
      expect(count).toBe(1);
      expect((await Invoice.findOne({ id: 1 })).ticket_status).toBe('EXPIRED');
    });

    it('leaves an ISSUED ticket alone while its showtime is still upcoming', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const movie_date = future.toISOString().split('T')[0];
      await Schedule.create({
        id: 1, movie_id: 1, room_id: 1, movie_date, time_begin: '10:00', time_end: '12:00', price: 1,
      });
      await Movie.create({ id: 1, name: 'Upcoming Movie', premiere_date: '2026-01-01', duration: 120 });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
      await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, ticket_status: 'ISSUED' });

      expect(await bookingRepository.expireIssuedTickets()).toBe(0);
      expect((await Invoice.findOne({ id: 1 })).ticket_status).toBe('ISSUED');
    });

    it('never touches a ticket that already left the ISSUED state (e.g. USED)', async () => {
      await Schedule.create({
        id: 1, movie_id: 1, room_id: 1, movie_date: '2020-01-01', time_begin: '10:00', time_end: '12:00', price: 1,
      });
      await Movie.create({ id: 1, name: 'Old Movie', premiere_date: '2020-01-01', duration: 120 });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
      await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, ticket_status: 'USED', checked_in: true });

      expect(await bookingRepository.expireIssuedTickets()).toBe(0);
      expect((await Invoice.findOne({ id: 1 })).ticket_status).toBe('USED');
    });

    it('returns 0 without touching anything when there are no ISSUED tickets', async () => {
      expect(await bookingRepository.expireIssuedTickets()).toBe(0);
    });
  });

  it('findInvoicesByAccountId sorts newest first', async () => {
    await Invoice.create([
      { id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, createdAt: new Date('2026-01-01') },
      { id: 2, ticket_id: 2, account_id: 1, code: 'B', total_price: 1, createdAt: new Date('2026-01-02') },
    ]);
    const result = await bookingRepository.findInvoicesByAccountId(1);
    expect(result[0].id).toBe(2);
  });

  it('findTicketsByIds / findSchedulesByIds / findMoviesByIds fetch by id lists', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Movie.create({ id: 1, name: 'M', premiere_date: '2026-01-01' });

    expect(await bookingRepository.findTicketsByIds([1])).toHaveLength(1);
    expect(await bookingRepository.findSchedulesByIds([1])).toHaveLength(1);
    expect(await bookingRepository.findMoviesByIds([1])).toHaveLength(1);
  });

  it('findInvoiceById / findTicketById / findScheduleById fetch a single doc', async () => {
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });

    expect(await bookingRepository.findInvoiceById('1')).not.toBeNull();
    expect(await bookingRepository.findTicketById('1')).not.toBeNull();
    expect(await bookingRepository.findScheduleById('1')).not.toBeNull();
  });

  it('updateTicketStatus and saveInvoice persist changes', async () => {
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
    await bookingRepository.updateTicketStatus(1, 0);
    expect((await Ticket.findOne({ id: 1 })).status).toBe(0);

    const invoice = await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, status: 1 });
    invoice.status = 0;
    await bookingRepository.saveInvoice(invoice);
    expect((await Invoice.findOne({ id: 1 })).status).toBe(0);
  });

  it('findAllInvoices paginates newest first', async () => {
    await Invoice.create([
      { id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 1, createdAt: new Date('2026-01-01') },
      { id: 2, ticket_id: 2, account_id: 1, code: 'B', total_price: 1, createdAt: new Date('2026-01-02') },
    ]);
    const result = await bookingRepository.findAllInvoices({ skip: 0, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe(2);
  });

  it('findAccountsByIds / findInvoiceByCode / findRoomById / findCinemaById / findMovieById', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1 });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'C1', code: 'A' });
    await Movie.create({ id: 1, name: 'M1', premiere_date: '2026-01-01' });

    expect(await bookingRepository.findAccountsByIds([1])).toHaveLength(1);
    expect(await bookingRepository.findInvoiceByCode('abc')).not.toBeNull();
    expect(await bookingRepository.findRoomById(1)).not.toBeNull();
    expect(await bookingRepository.findCinemaById(1)).not.toBeNull();
    expect(await bookingRepository.findMovieById(1)).not.toBeNull();
  });

  it('findCinemaIdByInvoiceId / findCinemaIdByTicketId walk the invoice/ticket chain to a branch', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'C1', code: 'A' });
    await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
    await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
    await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'ABC', total_price: 1 });

    expect(await bookingRepository.findCinemaIdByInvoiceId(1)).toBe(1);
    expect(await bookingRepository.findCinemaIdByTicketId(1)).toBe(1);
  });

  it('findCinemaIdByInvoiceId returns null for an unknown invoice', async () => {
    expect(await bookingRepository.findCinemaIdByInvoiceId(999)).toBeNull();
  });

  describe('seat holds', () => {
    it('holdTickets claims an available seat and leaves others untouched', async () => {
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 0 },
      ]);
      const until = new Date(Date.now() + 60000);
      const result = await bookingRepository.holdTickets({ scheduleId: 1, seatCodes: ['A1', 'A2'], accountId: 42, until });
      const byCode = new Map(result.map((t) => [t.seat_code, t]));
      expect(byCode.get('A1').status).toBe(2);
      expect(byCode.get('A1').held_by).toBe(42);
      expect(byCode.get('A2').status).toBe(0);
    });

    it('holdTickets does not steal a seat already held by another account', async () => {
      await Ticket.create({
        id: 1,
        schedule_id: 1,
        seat_index: 0,
        seat_code: 'A1',
        status: 2,
        held_by: 7,
        held_until: new Date(Date.now() + 60000),
      });
      const result = await bookingRepository.holdTickets({
        scheduleId: 1,
        seatCodes: ['A1'],
        accountId: 42,
        until: new Date(Date.now() + 60000),
      });
      expect(result[0].held_by).toBe(7);
    });

    it('releaseTickets only releases seats held by the given account', async () => {
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 42, held_until: new Date(Date.now() + 60000) },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 2, held_by: 7, held_until: new Date(Date.now() + 60000) },
      ]);
      const result = await bookingRepository.releaseTickets({ scheduleId: 1, seatCodes: ['A1', 'A2'], accountId: 42 });
      const byCode = new Map(result.map((t) => [t.seat_code, t]));
      expect(byCode.get('A1').status).toBe(1);
      expect(byCode.get('A1').held_by).toBeNull();
      expect(byCode.get('A2').status).toBe(2);
      expect(byCode.get('A2').held_by).toBe(7);
    });

    it('expireHeldTickets releases only holds whose TTL has passed', async () => {
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 42, held_until: new Date(Date.now() - 1000) },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 2, held_by: 42, held_until: new Date(Date.now() + 60000) },
      ]);
      await bookingRepository.expireHeldTickets(1);
      const tickets = await Ticket.find({ schedule_id: 1 }).sort({ seat_code: 1 });
      expect(tickets[0].status).toBe(1);
      expect(tickets[0].held_by).toBeNull();
      expect(tickets[1].status).toBe(2);
    });

    it('expireHeldTickets ends with a ticket in AVAILABLE, not stuck in TIMEOUT', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 42, held_until: new Date(Date.now() - 1000) });
      await bookingRepository.expireHeldTickets(1);
      const ticket = await Ticket.findOne({ id: 1 });
      expect(ticket.status).toBe(Ticket.STATUS.AVAILABLE);
      expect(ticket.status).not.toBe(Ticket.STATUS.TIMEOUT);
    });

    it('expireHeldTickets self-heals a ticket already stuck in TIMEOUT from a previous crashed sweep', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: Ticket.STATUS.TIMEOUT, held_by: 42, held_until: new Date(Date.now() + 60000) });
      await bookingRepository.expireHeldTickets(1);
      const ticket = await Ticket.findOne({ id: 1 });
      expect(ticket.status).toBe(Ticket.STATUS.AVAILABLE);
      expect(ticket.held_by).toBeNull();
    });

    it('expireAllHeldTickets releases expired holds across every schedule', async () => {
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 42, held_until: new Date(Date.now() - 1000) },
        { id: 2, schedule_id: 2, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7, held_until: new Date(Date.now() - 1000) },
        { id: 3, schedule_id: 3, seat_index: 0, seat_code: 'A1', status: 2, held_by: 7, held_until: new Date(Date.now() + 60000) },
      ]);
      await bookingRepository.expireAllHeldTickets();
      const tickets = await Ticket.find().sort({ id: 1 });
      expect(tickets[0].status).toBe(1);
      expect(tickets[0].held_by).toBeNull();
      expect(tickets[1].status).toBe(1);
      expect(tickets[1].held_by).toBeNull();
      expect(tickets[2].status).toBe(2);
      expect(tickets[2].held_by).toBe(7);
    });

    it('holdTickets is transaction-safe under real concurrency: only one of two simultaneous holders wins the same seat', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
      const until = new Date(Date.now() + 60000);

      const [resultA, resultB] = await Promise.all([
        bookingRepository.holdTickets({ scheduleId: 1, seatCodes: ['A1'], accountId: 1, until }),
        bookingRepository.holdTickets({ scheduleId: 1, seatCodes: ['A1'], accountId: 2, until }),
      ]);

      const winners = new Set([resultA[0].held_by, resultB[0].held_by]);
      expect(winners.size).toBe(1);
      const [winner] = winners;
      expect([1, 2]).toContain(winner);

      const ticket = await Ticket.findOne({ id: 1 });
      expect(ticket.status).toBe(2);
      expect(ticket.held_by).toBe(winner);
    });

    it('holdTickets under N-way concurrency: exactly one of many simultaneous holders wins', async () => {
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
      const until = new Date(Date.now() + 60000);
      const accountIds = [1, 2, 3, 4, 5];

      await Promise.all(
        accountIds.map((accountId) =>
          bookingRepository.holdTickets({ scheduleId: 1, seatCodes: ['A1'], accountId, until }),
        ),
      );

      const ticket = await Ticket.findOne({ id: 1 });
      expect(ticket.status).toBe(2);
      expect(accountIds).toContain(ticket.held_by);
    });

    describe('timeoutTicketsByIds', () => {
      it('immediately releases specific held tickets regardless of schedule', async () => {
        await Ticket.create([
          { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 42, held_until: new Date(Date.now() + 60000) },
          { id: 2, schedule_id: 2, seat_index: 0, seat_code: 'B1', status: 2, held_by: 42, held_until: new Date(Date.now() + 60000) },
        ]);
        await bookingRepository.timeoutTicketsByIds([1, 2]);
        const tickets = await Ticket.find().sort({ id: 1 });
        expect(tickets.every((t) => t.status === Ticket.STATUS.AVAILABLE && t.held_by === null)).toBe(true);
      });

      it('leaves a ticket that is not currently HELD untouched', async () => {
        await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
        await bookingRepository.timeoutTicketsByIds([1]);
        expect((await Ticket.findOne({ id: 1 })).status).toBe(0);
      });

      it('leaves tickets not in the given id list untouched', async () => {
        await Ticket.create([
          { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 42, held_until: new Date(Date.now() + 60000) },
          { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 2, held_by: 42, held_until: new Date(Date.now() + 60000) },
        ]);
        await bookingRepository.timeoutTicketsByIds([1]);
        expect((await Ticket.findOne({ id: 2 })).held_by).toBe(42);
      });
    });

    it('findTicketsBySeatCodes scopes to the given schedule and seat codes', async () => {
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' },
        { id: 2, schedule_id: 2, seat_index: 0, seat_code: 'A1' },
      ]);
      const result = await bookingRepository.findTicketsBySeatCodes(1, ['A1']);
      expect(result).toHaveLength(1);
      expect(result[0].schedule_id).toBe(1);
    });
  });

  it('createCounterSale records a paid invoice with created_by set', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });

    await bookingRepository.createCounterSale({
      ticketIds: [1],
      comboIds: [],
      voucherCode: null,
      discountAmount: 0,
      totalPrice: 100000,
      accountId: 1,
      createdBy: 42,
    });

    const invoice = await Invoice.findOne({ ticket_id: 1 });
    expect(invoice.created_by).toBe(42);
    expect(invoice.status).toBe(1);
    expect((await Ticket.findOne({ id: 1 })).status).toBe(0);
  });

  describe('Booking aggregate', () => {
    it('createPendingBooking creates a PENDING booking with the given fields', async () => {
      const booking = await bookingRepository.createPendingBooking({
        code: 'BK-1',
        accountId: 10,
        scheduleId: 1,
        branchId: 1,
        ticketIds: [1, 2],
        comboIds: [5],
        voucherCode: 'save10',
        discountAmount: 1000,
        seatTotal: 20000,
        comboTotal: 5000,
        totalPrice: 24000,
        expiresAt: new Date(Date.now() + 60000),
      });
      expect(booking.status).toBe('PENDING');
      expect(booking.voucher_code).toBe('SAVE10');
      expect(booking.ticket_ids).toEqual([1, 2]);
    });

    it('createPendingBooking stores a promotion_code instead when given one', async () => {
      const booking = await bookingRepository.createPendingBooking({
        code: 'BK-1B',
        accountId: 10,
        scheduleId: 1,
        branchId: 1,
        ticketIds: [1],
        promotionCode: 'promo10',
        discountAmount: 2000,
        totalPrice: 18000,
        expiresAt: new Date(Date.now() + 60000),
      });
      expect(booking.promotion_code).toBe('PROMO10');
      expect(booking.voucher_code).toBeNull();
    });

    it('finalizeMomoOrder flips a pre-created PENDING booking to PAID and stamps booking_id on every invoice', async () => {
      await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 2 },
      ]);
      const pending = await bookingRepository.createPendingBooking({
        code: 'BK-2',
        accountId: 10,
        scheduleId: 1,
        branchId: 1,
        ticketIds: [1, 2],
        totalPrice: 100000,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await bookingRepository.finalizeMomoOrder('BK-2', {
        ticketIds: [1, 2],
        totalPrice: 100000,
        accountId: 10,
      });

      expect(result.bookingId).toBe(pending.id);
      const booking = await Booking.findOne({ id: pending.id });
      expect(booking.status).toBe('PAID');
      expect(booking.paid_at).toBeInstanceOf(Date);
      const invoices = await Invoice.find({ booking_id: pending.id });
      expect(invoices).toHaveLength(2);
    });

    it('finalizeMomoOrder creates a PAID ComboOrder linked to the booking when combos were purchased', async () => {
      await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
      await Combo.create([
        { id: 1, cinema_id: 1, name: 'Popcorn Combo', price: 50000 },
        { id: 2, cinema_id: 1, name: 'Coke', price: 20000, type: 'BEVERAGE' },
      ]);
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2 });
      const pending = await bookingRepository.createPendingBooking({
        code: 'BK-3',
        accountId: 10,
        scheduleId: 1,
        branchId: 1,
        ticketIds: [1],
        comboIds: [1, 1, 2],
        totalPrice: 220000,
        expiresAt: new Date(Date.now() + 60000),
      });

      await bookingRepository.finalizeMomoOrder(
        'BK-3',
        { ticketIds: [1], comboIds: [1, 1, 2], totalPrice: 220000, accountId: 10 },
        { comboPaymentMethod: 'MOMO' },
      );

      const order = await ComboOrder.findOne({ booking_id: pending.id });
      expect(order).not.toBeNull();
      expect(order.status).toBe('PAID');
      expect(order.payment_method).toBe('MOMO');
      expect(order.branch_id).toBe(1);
      expect(order.account_id).toBe(10);
      expect(order.total_price).toBe(120000);
      expect(order.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ combo_id: 1, quantity: 2, unit_price: 50000, line_total: 100000 }),
          expect.objectContaining({ combo_id: 2, quantity: 1, unit_price: 20000, line_total: 20000 }),
        ]),
      );
    });

    it('createCounterSale creates a linked ComboOrder paid by CASH when combos were purchased', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'C1', code: 'A' });
      await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
      await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });
      await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn Combo', price: 50000 });

      const result = await bookingRepository.createCounterSale({
        ticketIds: [1],
        comboIds: [1],
        voucherCode: null,
        discountAmount: 0,
        totalPrice: 150000,
        accountId: 1,
        createdBy: 42,
        branchId: 1,
      });

      const order = await ComboOrder.findOne({ booking_id: result.bookingId });
      expect(order).not.toBeNull();
      expect(order.status).toBe('PAID');
      expect(order.payment_method).toBe('CASH');
      expect(order.created_by).toBe(42);
    });

    it('finalizeMomoOrder silently drops combo ids that no longer resolve to a Combo', async () => {
      await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2 });
      await bookingRepository.createPendingBooking({
        code: 'BK-4',
        accountId: 10,
        scheduleId: 1,
        branchId: 1,
        ticketIds: [1],
        comboIds: [999],
        totalPrice: 100000,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await bookingRepository.finalizeMomoOrder('BK-4', {
        ticketIds: [1],
        comboIds: [999],
        totalPrice: 100000,
        accountId: 10,
      });

      expect(result.alreadyProcessed).toBe(false);
      expect(await ComboOrder.countDocuments()).toBe(0);
    });

    it('finalizeMomoOrder does not create a second ComboOrder on a retried call for the same order', async () => {
      await Account.create({ id: 10, email: 'buyer@example.com', password: 'x' });
      await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn Combo', price: 50000 });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2 });
      await bookingRepository.createPendingBooking({
        code: 'BK-5',
        accountId: 10,
        scheduleId: 1,
        branchId: 1,
        ticketIds: [1],
        comboIds: [1],
        totalPrice: 150000,
        expiresAt: new Date(Date.now() + 60000),
      });

      const payload = { ticketIds: [1], comboIds: [1], totalPrice: 150000, accountId: 10 };
      await bookingRepository.finalizeMomoOrder('BK-5', payload);
      const retried = await bookingRepository.finalizeMomoOrder('BK-5', payload);

      expect(retried.alreadyProcessed).toBe(true);
      expect(await ComboOrder.countDocuments()).toBe(1);
    });

    it('finalizeMomoOrder creates a PAID booking directly when none was pre-created (counter sale)', async () => {
      await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'C1', code: 'A' });
      await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
      await Schedule.create({ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' });

      const result = await bookingRepository.createCounterSale({
        ticketIds: [1],
        comboIds: [],
        voucherCode: null,
        discountAmount: 0,
        totalPrice: 100000,
        accountId: 1,
        createdBy: 42,
      });

      const booking = await Booking.findOne({ id: result.bookingId });
      expect(booking.status).toBe('PAID');
      expect(booking.branch_id).toBe(1);
    });

    it('cancelBooking releases tickets and cancels sibling invoices', async () => {
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 0 },
      ]);
      const booking = await Booking.create({
        id: 1,
        code: 'BK-3',
        account_id: 1,
        schedule_id: 1,
        branch_id: 1,
        ticket_ids: [1, 2],
        total_price: 100000,
        status: 'PAID',
      });
      await Invoice.create([
        { id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'BK-3', total_price: 50000, status: 1 },
        { id: 2, booking_id: 1, ticket_id: 2, account_id: 1, code: 'BK-3', total_price: 50000, status: 1 },
      ]);

      const cancelled = await bookingRepository.cancelBooking(booking, { reason: 'customer request' });
      expect(cancelled.status).toBe('CANCELLED');
      expect(cancelled.cancel_reason).toBe('customer request');

      const tickets = await Ticket.find().sort({ id: 1 });
      expect(tickets.every((t) => t.status === 1)).toBe(true);
      const invoices = await Invoice.find({ booking_id: 1 });
      expect(invoices.every((inv) => inv.status === 0)).toBe(true);
    });

    describe('changeBookingShowtime', () => {
      it('releases the old tickets, books the new ones, and moves the booking', async () => {
        await Ticket.create([
          { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 },
          { id: 2, schedule_id: 2, seat_index: 0, seat_code: 'B1', status: 1 },
        ]);
        const booking = await Booking.create({
          id: 1,
          code: 'BK-4',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          ticket_ids: [1],
          total_price: 100000,
          status: 'PENDING',
        });

        const updated = await bookingRepository.changeBookingShowtime(booking, { newScheduleId: 2, newTicketIds: [2] });

        expect(updated.schedule_id).toBe(2);
        expect(updated.ticket_ids).toEqual([2]);
        expect((await Ticket.findOne({ id: 1 })).status).toBe(1);
        expect((await Ticket.findOne({ id: 2 })).status).toBe(0);
      });

      it('re-points sibling invoices at the new ticket ids (paired 1:1 by array position) only for a PAID booking', async () => {
        await Ticket.create([
          { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 },
          { id: 2, schedule_id: 2, seat_index: 0, seat_code: 'B1', status: 1 },
        ]);
        const booking = await Booking.create({
          id: 1,
          code: 'BK-5',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          ticket_ids: [1],
          total_price: 100000,
          status: 'PAID',
        });
        await Invoice.create({ id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'BK-5', total_price: 100000, status: 1, ticket_status: 'ISSUED' });

        await bookingRepository.changeBookingShowtime(booking, { newScheduleId: 2, newTicketIds: [2] });

        const invoice = await Invoice.findOne({ id: 1 });
        expect(invoice.ticket_id).toBe(2);
        expect(invoice.ticket_status).toBe('ISSUED'); // untouched
        expect(invoice.total_price).toBe(100000); // price carried over, not recomputed
      });

      it('does not touch invoices for a PENDING booking (none exist yet)', async () => {
        await Ticket.create([
          { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 2, held_by: 1 },
          { id: 2, schedule_id: 2, seat_index: 0, seat_code: 'B1', status: 1 },
        ]);
        const booking = await Booking.create({
          id: 1,
          code: 'BK-7',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          ticket_ids: [1],
          total_price: 100000,
          status: 'PENDING',
        });

        await bookingRepository.changeBookingShowtime(booking, { newScheduleId: 2, newTicketIds: [2] });

        expect(await Invoice.countDocuments({ booking_id: 1 })).toBe(0);
        expect((await Ticket.findOne({ id: 1 })).held_by).toBeNull();
      });
    });

    describe('findBookingsBySchedule', () => {
      it('returns only bookings matching the given statuses on that schedule', async () => {
        await Booking.create([
          { id: 1, code: 'BK-A', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 1, status: 'PAID' },
          { id: 2, code: 'BK-B', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 1, status: 'CANCELLED' },
          { id: 3, code: 'BK-C', account_id: 1, schedule_id: 2, branch_id: 1, total_price: 1, status: 'PAID' },
        ]);
        const found = await bookingRepository.findBookingsBySchedule(1, ['PAID', 'PENDING']);
        expect(found.map((b) => b.id)).toEqual([1]);
      });
    });

    describe('cancelBookingAndRequestRefund', () => {
      it('releases tickets, cancels invoices, and flips a PAID Payment to REFUND_PENDING', async () => {
        const Payment = require('../models/Payment');
        await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
        const booking = await Booking.create({
          id: 1,
          code: 'BK-6',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          ticket_ids: [1],
          total_price: 100000,
          status: 'PAID',
        });
        await Invoice.create({ id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'BK-6', total_price: 100000, status: 1 });
        await Payment.create({ id: 1, code: 'BK-6', booking_id: 1, account_id: 1, type: 'ONLINE', method: 'MOMO', amount: 100000, status: 'PAID' });

        await bookingRepository.cancelBookingAndRequestRefund(booking, 'Showtime cancelled by cinema');

        expect((await Booking.findOne({ id: 1 })).status).toBe('CANCELLED');
        expect((await Ticket.findOne({ id: 1 })).status).toBe(1);
        expect((await Invoice.findOne({ id: 1 })).status).toBe(0);
        const payment = await Payment.findOne({ id: 1 });
        expect(payment.status).toBe('REFUND_PENDING');
        expect(payment.refund_reason).toBe('Showtime cancelled by cinema');
      });

      it('cancels the booking without touching any Payment when it was never paid', async () => {
        const Payment = require('../models/Payment');
        const booking = await Booking.create({
          id: 1,
          code: 'BK-7',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          total_price: 100000,
          status: 'PENDING',
        });

        await bookingRepository.cancelBookingAndRequestRefund(booking, 'Showtime cancelled by cinema');

        expect((await Booking.findOne({ id: 1 })).status).toBe('CANCELLED');
        expect(await Payment.findOne({ code: 'BK-7' })).toBeNull();
      });
    });

    describe('markNeedsRescheduleResponse / acceptReschedule', () => {
      it('sets and clears the needs_reschedule_response flag', async () => {
        const booking = await Booking.create({
          id: 1,
          code: 'BK-8',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          total_price: 100000,
          status: 'PAID',
        });

        await bookingRepository.markNeedsRescheduleResponse(booking.id, true);
        expect((await Booking.findOne({ id: 1 })).needs_reschedule_response).toBe(true);

        const reloaded = await Booking.findOne({ id: 1 });
        const accepted = await bookingRepository.acceptReschedule(reloaded);
        expect(accepted.needs_reschedule_response).toBe(false);
        expect((await Booking.findOne({ id: 1 })).needs_reschedule_response).toBe(false);
      });
    });

    it('expireStalePendingBookings flips lapsed PENDING bookings to EXPIRED and releases their held tickets', async () => {
      await Ticket.create({
        id: 1,
        schedule_id: 1,
        seat_index: 0,
        seat_code: 'A1',
        status: 2,
        held_by: 10,
        held_until: new Date(Date.now() - 1000),
      });
      await Booking.create({
        id: 1,
        code: 'BK-4',
        account_id: 10,
        schedule_id: 1,
        branch_id: 1,
        ticket_ids: [1],
        total_price: 50000,
        status: 'PENDING',
        expires_at: new Date(Date.now() - 1000),
      });
      await Booking.create({
        id: 2,
        code: 'BK-5',
        account_id: 10,
        schedule_id: 1,
        branch_id: 1,
        ticket_ids: [],
        total_price: 50000,
        status: 'PENDING',
        expires_at: new Date(Date.now() + 60000),
      });

      const expiredCount = await bookingRepository.expireStalePendingBookings();
      expect(expiredCount).toBe(1);

      expect((await Booking.findOne({ id: 1 })).status).toBe('EXPIRED');
      expect((await Booking.findOne({ id: 2 })).status).toBe('PENDING');
      const ticket = await Ticket.findOne({ id: 1 });
      expect(ticket.status).toBe(Ticket.STATUS.AVAILABLE);
      expect(ticket.held_by).toBeNull();
    });

    describe('maybeCompleteBooking', () => {
      it('marks a PAID booking COMPLETED once every sibling invoice is checked in', async () => {
        await Booking.create({
          id: 1,
          code: 'BK-6',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          ticket_ids: [1, 2],
          total_price: 100000,
          status: 'PAID',
        });
        await Invoice.create([
          { id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'BK-6', total_price: 50000, status: 1, checked_in: true },
          { id: 2, booking_id: 1, ticket_id: 2, account_id: 1, code: 'BK-6', total_price: 50000, status: 1, checked_in: true },
        ]);

        await bookingRepository.maybeCompleteBooking(1);
        expect((await Booking.findOne({ id: 1 })).status).toBe('COMPLETED');
      });

      it('leaves the booking PAID while any sibling invoice is not yet checked in', async () => {
        await Booking.create({
          id: 1,
          code: 'BK-7',
          account_id: 1,
          schedule_id: 1,
          branch_id: 1,
          ticket_ids: [1, 2],
          total_price: 100000,
          status: 'PAID',
        });
        await Invoice.create([
          { id: 1, booking_id: 1, ticket_id: 1, account_id: 1, code: 'BK-7', total_price: 50000, status: 1, checked_in: true },
          { id: 2, booking_id: 1, ticket_id: 2, account_id: 1, code: 'BK-7', total_price: 50000, status: 1, checked_in: false },
        ]);

        await bookingRepository.maybeCompleteBooking(1);
        expect((await Booking.findOne({ id: 1 })).status).toBe('PAID');
      });

      it('is a no-op for a null bookingId', async () => {
        await expect(bookingRepository.maybeCompleteBooking(null)).resolves.toBeNull();
      });
    });

    describe('resolveAccessibleBranchIds', () => {
      it('returns every branch owned by a Branch Admin', async () => {
        await Branch.create([
          { id: 1, company_id: 1, owner_id: 5, name: 'C1', code: 'A' },
          { id: 2, company_id: 1, owner_id: 5, name: 'C2', code: 'B' },
          { id: 3, company_id: 1, owner_id: 6, name: 'C3', code: 'C' },
        ]);
        const branchIds = await bookingRepository.resolveAccessibleBranchIds(5);
        expect(branchIds.sort()).toEqual([1, 2]);
      });

      it("returns an Employee's single assigned branch", async () => {
        await Employee.create({ id: 1, user_id: 20, branch_id: 3, employee_code: 'E1', position_id: 1, status: 1 });
        const branchIds = await bookingRepository.resolveAccessibleBranchIds(20);
        expect(branchIds).toEqual([3]);
      });

      it('returns an empty list for an account that is neither a branch owner nor an active employee', async () => {
        expect(await bookingRepository.resolveAccessibleBranchIds(999)).toEqual([]);
      });
    });

    describe('findBookings / findBookingById', () => {
      it('paginates newest first and supports a filter', async () => {
        await Booking.create([
          { id: 1, code: 'BK-8', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 1, status: 'PENDING', createdAt: new Date('2026-01-01') },
          { id: 2, code: 'BK-9', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 1, status: 'PAID', createdAt: new Date('2026-01-02') },
        ]);
        const result = await bookingRepository.findBookings({}, { skip: 0, limit: 20 });
        expect(result.total).toBe(2);
        expect(result.data[0].id).toBe(2);

        const paidOnly = await bookingRepository.findBookings({ status: 'PAID' }, { skip: 0, limit: 20 });
        expect(paidOnly.total).toBe(1);
        expect(paidOnly.data[0].id).toBe(2);
      });

      it('findBookingById fetches a single booking', async () => {
        await Booking.create({ id: 1, code: 'BK-10', account_id: 1, schedule_id: 1, branch_id: 1, total_price: 1 });
        expect(await bookingRepository.findBookingById('1')).not.toBeNull();
        expect(await bookingRepository.findBookingById('999')).toBeNull();
      });
    });

    describe('computeOrderPricing', () => {
      async function seedSchedule(overrides = {}) {
        await Schedule.create({
          id: 1,
          movie_id: 7,
          room_id: 1,
          cinema_id: 5,
          movie_date: '2026-01-01',
          time_begin: '10:00',
          time_end: '12:00',
          price: 100000,
          ...overrides,
        });
        await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 1 });
      }

      it('applies a voucher when both a voucher and a promotion code are somehow both sent', async () => {
        await seedSchedule();
        await Voucher.create({ id: 1, code: 'SAVE10', discount_type: 'fixed', discount_value: 5000 });
        await Promotion.create({
          id: 1,
          code: 'PROMO10',
          name: 'Promo',
          discount_type: 'FIXED_AMOUNT',
          discount_value: 9000,
          start_at: new Date(Date.now() - 86400000),
          end_at: new Date(Date.now() + 86400000),
        });

        const pricing = await bookingRepository.computeOrderPricing({
          ticketIds: [1],
          voucherCode: 'save10',
          promotionCode: 'promo10',
          accountId: 42,
        });
        expect(pricing.voucherCode).toBe('SAVE10');
        expect(pricing.promotionCode).toBeNull();
        expect(pricing.discountAmount).toBe(5000);
      });

      it('computes an eligible percentage promotion discount', async () => {
        await seedSchedule();
        await Promotion.create({
          id: 1,
          code: 'PROMO10',
          name: 'Promo',
          discount_type: 'PERCENTAGE',
          discount_value: 10,
          start_at: new Date(Date.now() - 86400000),
          end_at: new Date(Date.now() + 86400000),
        });

        const pricing = await bookingRepository.computeOrderPricing({
          ticketIds: [1],
          promotionCode: 'promo10',
          accountId: 42,
        });
        expect(pricing.promotionCode).toBe('PROMO10');
        expect(pricing.discountAmount).toBe(10000);
        expect(pricing.totalPrice).toBe(90000);
      });

      it('respects a promotion scoped to a different branch', async () => {
        await seedSchedule();
        await Promotion.create({
          id: 1,
          code: 'OTHERBRANCH',
          name: 'Promo',
          discount_type: 'FIXED_AMOUNT',
          discount_value: 5000,
          start_at: new Date(Date.now() - 86400000),
          end_at: new Date(Date.now() + 86400000),
          branch_ids: [999],
        });

        const pricing = await bookingRepository.computeOrderPricing({
          ticketIds: [1],
          promotionCode: 'OTHERBRANCH',
          accountId: 42,
        });
        expect(pricing.promotionCode).toBeNull();
        expect(pricing.discountAmount).toBe(0);
        expect(pricing.totalPrice).toBe(100000);
      });

      it('respects a per-customer usage limit already reached by this account', async () => {
        await seedSchedule();
        await Promotion.create({
          id: 1,
          code: 'ONCEONLY',
          name: 'Promo',
          discount_type: 'FIXED_AMOUNT',
          discount_value: 5000,
          start_at: new Date(Date.now() - 86400000),
          end_at: new Date(Date.now() + 86400000),
          per_customer_limit: 1,
        });
        await PromotionUsage.create({ promotion_id: 1, account_id: 42, count: 1 });

        const pricing = await bookingRepository.computeOrderPricing({
          ticketIds: [1],
          promotionCode: 'ONCEONLY',
          accountId: 42,
        });
        expect(pricing.promotionCode).toBeNull();
        expect(pricing.discountAmount).toBe(0);
      });
    });
  });
});
