const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const notificationRepository = require('./notification.repository');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Movie = require('../models/Movie');
const Branch = require('../models/Branch');
const Invoice = require('../models/Invoice');

beforeAll(async () => {
  await connect();
  await Notification.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('notification.repository.create', () => {
  it('appends a row with sensible defaults', async () => {
    const n = await notificationRepository.create({
      accountId: 7,
      type: 'BOOKING_CREATED',
      title: 'Booking created',
      dedupeKey: 'BOOKING_CREATED:7:1',
    });
    expect(n.id).toBe(1);
    expect(n.channels).toEqual(['IN_APP']);
    expect(n.status).toBe('PENDING');
  });

  it('returns null (no throw) on a duplicate dedupe_key — the no-duplicate rule', async () => {
    const first = await notificationRepository.create({
      accountId: 7, type: 'PAYMENT_SUCCESS', title: 'ok', dedupeKey: 'PAYMENT_SUCCESS:7:1',
    });
    const second = await notificationRepository.create({
      accountId: 7, type: 'PAYMENT_SUCCESS', title: 'ok', dedupeKey: 'PAYMENT_SUCCESS:7:1',
    });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await Notification.countDocuments()).toBe(1);
  });
});

describe('notification.repository reads', () => {
  async function seed() {
    await notificationRepository.create({ accountId: 7, type: 'BOOKING_CREATED', title: 'a', dedupeKey: 'a' });
    await notificationRepository.create({ accountId: 7, type: 'PAYMENT_SUCCESS', title: 'b', dedupeKey: 'b' });
    await notificationRepository.create({ accountId: 99, type: 'BOOKING_CREATED', title: 'c', dedupeKey: 'c' });
  }

  it('findForAccount returns only that account, newest first, paginated', async () => {
    await seed();
    const { data, total } = await notificationRepository.findForAccount(7, { skip: 0, limit: 1 });
    expect(total).toBe(2);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe(2);
  });

  it('findForAccount can filter to unread only', async () => {
    await seed();
    await notificationRepository.markRead(1, 7);
    const { total } = await notificationRepository.findForAccount(7, { unread: true });
    expect(total).toBe(1);
  });

  it('countUnread counts only the caller unread rows', async () => {
    await seed();
    expect(await notificationRepository.countUnread(7)).toBe(2);
    await notificationRepository.markAllRead(7);
    expect(await notificationRepository.countUnread(7)).toBe(0);
    expect(await notificationRepository.countUnread(99)).toBe(1);
  });

  it('markRead is scoped to the owner', async () => {
    await seed();
    expect(await notificationRepository.markRead(1, 99)).toBeNull();
    const ok = await notificationRepository.markRead(1, 7);
    expect(ok.read_at).toBeInstanceOf(Date);
  });
});

describe('notification.repository delivery state', () => {
  it('markSent / markFailed drive the retry window', async () => {
    await notificationRepository.create({ accountId: 7, type: 'PAYMENT_SUCCESS', title: 'x', dedupeKey: 'x', maxAttempts: 3 });
    const soon = new Date(Date.now() + 1000);
    await notificationRepository.markFailed(1, { error: 'smtp down', attempts: 1, nextAttemptAt: soon });
    let row = await notificationRepository.findById(1);
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(1);

    // not yet due
    expect(await notificationRepository.findRetryable(new Date(Date.now() - 1000))).toHaveLength(0);
    // due now
    expect(await notificationRepository.findRetryable(new Date(Date.now() + 5000))).toHaveLength(1);

    // exhausted -> no next_attempt_at -> not retryable
    await notificationRepository.markFailed(1, { error: 'again', attempts: 3, nextAttemptAt: null });
    expect(await notificationRepository.findRetryable(new Date(Date.now() + 999999))).toHaveLength(0);

    await notificationRepository.markSent(1);
    row = await notificationRepository.findById(1);
    expect(row.status).toBe('SENT');
    expect(row.sent_at).toBeInstanceOf(Date);
    expect(row.next_attempt_at).toBeNull();
  });
});

describe('notification.repository.loadContext', () => {
  it('returns only safe display fields for a booking', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 2, name: 'Downtown', code: 'DT' });
    await Room.create({ id: 1, cinema_id: 1, name: 'Room 3' });
    await Movie.create({ id: 1, name: 'Dune', premiere_date: '2026-01-01' });
    await Schedule.create({
      id: 1, movie_id: 1, room_id: 1, cinema_id: 1, movie_date: '2026-09-01', time_begin: '19:00', time_end: '21:00', price: 100,
    });
    await Ticket.create([
      { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1' },
      { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2' },
    ]);
    await Booking.create({
      id: 1, code: 'BK-1', account_id: 7, schedule_id: 1, branch_id: 1, ticket_ids: [1, 2], total_price: 200,
    });
    await Invoice.create({ id: 1, booking_id: 1, ticket_id: 1, account_id: 7, code: 'BK-1', total_price: 100, qr_token: 'QR-1' });

    const ctx = await notificationRepository.loadContext(1);
    expect(ctx).toEqual({
      bookingCode: 'BK-1',
      seats: ['A1', 'A2'],
      ticketCodes: ['QR-1'],
      movie: 'Dune',
      branch: 'Downtown',
      room: 'Room 3',
      showtime: { date: '2026-09-01', time_begin: '19:00', time_end: '21:00' },
    });
  });

  it('degrades to {} for an unknown booking', async () => {
    expect(await notificationRepository.loadContext(999)).toEqual({});
    expect(await notificationRepository.loadContext(null)).toEqual({});
  });
});
