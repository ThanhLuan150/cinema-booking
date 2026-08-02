jest.mock('../utils/mailer', () => ({ sendInvoiceEmail: jest.fn().mockResolvedValue({}) }));
jest.mock('../utils/socket', () => ({ emitToOwner: jest.fn() }));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const bookingRepository = require('./booking.repository');
const mailer = require('../utils/mailer');
const socket = require('../utils/socket');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Account = require('../models/Account');
const Voucher = require('../models/Voucher');
const Room = require('../models/Room');
const Cinema = require('../models/Cinema');
const Movie = require('../models/Movie');

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

  describe('finalizeMomoOrder', () => {
    async function seedOrder() {
      await Cinema.create({ id: 1, owner_id: 77, name: 'Cinema' });
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

      expect(result).toEqual({ alreadyProcessed: false });
      const invoices = await Invoice.find().sort({ ticket_id: 1 });
      expect(invoices).toHaveLength(2);
      expect(invoices[0].total_price + invoices[1].total_price).toBe(100001);
      expect(invoices[0].total_price).toBe(50001);
      expect(invoices[1].total_price).toBe(50000);

      const tickets = await Ticket.find().sort({ id: 1 });
      expect(tickets.every((t) => t.status === 0)).toBe(true);

      expect(mailer.sendInvoiceEmail).toHaveBeenCalledWith('buyer@example.com', expect.objectContaining({
        seats: ['A1', 'A2'],
      }));
      expect(socket.emitToOwner).toHaveBeenCalledWith(77, 'booking:new', expect.objectContaining({ cinemaId: 1 }));
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

    it('is idempotent for a repeated orderId', async () => {
      await seedOrder();
      await bookingRepository.finalizeMomoOrder('ORDER-3', { ticketIds: [1], totalPrice: 1000, accountId: 10 });
      const result = await bookingRepository.finalizeMomoOrder('ORDER-3', { ticketIds: [1], totalPrice: 1000, accountId: 10 });
      expect(result).toEqual({ alreadyProcessed: true });
      expect(await Invoice.countDocuments()).toBe(1);
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
    await Cinema.create({ id: 1, owner_id: 1, name: 'C1' });
    await Movie.create({ id: 1, name: 'M1', premiere_date: '2026-01-01' });

    expect(await bookingRepository.findAccountsByIds([1])).toHaveLength(1);
    expect(await bookingRepository.findInvoiceByCode('abc')).not.toBeNull();
    expect(await bookingRepository.findRoomById(1)).not.toBeNull();
    expect(await bookingRepository.findCinemaById(1)).not.toBeNull();
    expect(await bookingRepository.findMovieById(1)).not.toBeNull();
  });
});
