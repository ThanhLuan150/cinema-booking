jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed
jest.mock('../utils/mailer', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({}),
  sendNotificationEmail: jest.fn().mockResolvedValue({ messageId: 'x' }),
}));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, customer, seedSoldOutShowtime, soldBooking } = require('../../tests/waitlistFixtures');
const waitlistService = require('./waitlist.service');
const systemConfigService = require('./systemConfig.service');
const bookingRepository = require('../repositories/booking.repository');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Waitlist = require('../models/Waitlist');
const WaitlistLock = require('../models/WaitlistLock');
const socket = require('../utils/socket');

const MINUTE = 60 * 1000;
const { STATUS } = Waitlist;

beforeAll(async () => {
  await connect();
  await Promise.all([Waitlist.init(), WaitlistLock.init(), Notification.init()]);
});
beforeEach(() => systemConfigService.invalidateAll());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

const join = (n, body = {}) => waitlistService.join({ accountId: customer(n), body: { schedule_id: ID.SHOWTIME, ...body } });
const entryOf = (n) => Waitlist.findOne({ account_id: customer(n) }).sort({ id: -1 });
const ticket = (seatNumber) => Ticket.findOne({ id: seatNumber });
// Seat i comes free the way it does in production: its buyer cancels.
const freeSeat = async (seatNumber) => bookingRepository.cancelBooking(await soldBooking(seatNumber));
const notificationsFor = (n, type) => Notification.find({ account_id: customer(n), ...(type ? { type } : {}) });

async function expectRefusal(promise, code, status) {
  await expect(promise).rejects.toMatchObject({ name: 'WaitlistError', code, status });
}

describe('joining a waitlist', () => {
  beforeEach(() => seedSoldOutShowtime());

  it('queues a customer for a sold-out showtime', async () => {
    const view = await join(0);
    expect(view).toMatchObject({
      schedule_id: ID.SHOWTIME,
      seat_count: 1,
      status: STATUS.WAITING,
      position: 1,
      movie: { name: 'Dune: Part Three' },
      branch: { name: 'CineNova Central' },
      showtime: { room: 'Hall 3' },
    });
    expect(view).not.toHaveProperty('account_id');
    expect(socket.emitToAccount).toHaveBeenCalledWith(customer(0), 'waitlist:updated', expect.objectContaining({ status: 'WAITING' }));
  });

  it('refuses while a seat is still on sale', async () => {
    await Ticket.updateOne({ id: 2 }, { $set: { status: Ticket.STATUS.AVAILABLE } });
    await expect(join(0)).rejects.toMatchObject({ code: 'SHOWTIME_NOT_FULL', status: 409, extra: { available_seats: 1 } });
  });

  it('counts a lapsed hold as on sale, and an out-of-service seat as not', async () => {
    // X1 (DISABLED, ticket AVAILABLE) is in the fixture from the start, and joining works.
    await Ticket.updateOne(
      { id: 2 },
      { $set: { status: Ticket.STATUS.HELD, held_by: 999, held_until: new Date(Date.now() - MINUTE) } },
    );
    await expectRefusal(join(0), 'SHOWTIME_NOT_FULL', 409);

    await Ticket.updateOne({ id: 2 }, { $set: { held_until: new Date(Date.now() + MINUTE) } });
    await expect(join(0)).resolves.toMatchObject({ status: STATUS.WAITING });
  });

  it('lets a customer queue for more seats than are left', async () => {
    await Ticket.updateOne({ id: 2 }, { $set: { status: Ticket.STATUS.AVAILABLE } });
    await expect(join(0, { seat_count: 2 })).resolves.toMatchObject({ status: STATUS.WAITING, seat_count: 2 });
  });

  it('never lets a customer hold two places in the same queue', async () => {
    const first = await join(0);
    await expect(join(0)).rejects.toMatchObject({ code: 'WAITLIST_DUPLICATE', status: 409, extra: { entry: { id: first.id } } });
    expect(await Waitlist.countDocuments({ account_id: customer(0) })).toBe(1);
  });

  it('lets a customer who left queue again, at the back', async () => {
    const first = await join(0);
    await join(1);
    await waitlistService.cancelMine({ id: first.id, accountId: customer(0) });

    const again = await join(0);
    expect(again.id).toBeGreaterThan(first.id);
    expect(again.position).toBe(2);
  });

  it.each([
    ['nothing', 0],
    ['a fraction', 1.5],
    ['more than MAX_BOOKING_SEATS', 9],
    ['more seats than the room has', 7],
  ])('refuses a seat_count of %s', async (_label, seatCount) => {
    await expectRefusal(join(0, { seat_count: seatCount }), 'WAITLIST_SEAT_COUNT_INVALID', 400);
  });

  it('takes the customer from the token, never from the body', async () => {
    await expect(join(0, { account_id: customer(1) })).rejects.toMatchObject({
      code: 'WAITLIST_FIELD_NOT_ALLOWED',
      extra: { fields: ['account_id'] },
    });
    expect(await Waitlist.countDocuments()).toBe(0);
  });

  it('refuses an unknown, cancelled or started showtime', async () => {
    await expectRefusal(join(0, { schedule_id: 404 }), 'SHOWTIME_NOT_FOUND', 404);

    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { status: 'CANCELLED' } });
    await expectRefusal(join(0), 'SCHEDULE_CANCELLED', 400);

    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { status: 'ACTIVE' } });
    await expectRefusal(
      waitlistService.join({ accountId: customer(0), body: { schedule_id: ID.SHOWTIME }, now: new Date(Date.now() + 4 * 60 * MINUTE) }),
      'SHOWTIME_STARTED',
      400,
    );
  });
});

describe('serving the queue', () => {
  beforeEach(() => seedSoldOutShowtime());

  it('reserves a freed seat for the first customer to join, for the offer window', async () => {
    await join(0);
    await join(1);
    await join(2);
    const before = Date.now();

    await freeSeat(3);

    const first = await entryOf(0);
    expect(first.status).toBe(STATUS.NOTIFIED);
    expect(first.offered_seat_codes).toEqual(['A3']);
    expect(first.expires_at.getTime()).toBeGreaterThanOrEqual(before + 15 * MINUTE - 1000);
    expect(first.expires_at.getTime()).toBeLessThanOrEqual(Date.now() + 15 * MINUTE);

    const seat = await ticket(3);
    expect(seat).toMatchObject({ status: Ticket.STATUS.HELD, held_by: customer(0) });
    expect(seat.held_until.getTime()).toBe(first.expires_at.getTime());

    expect((await entryOf(1)).status).toBe(STATUS.WAITING);
    expect(await waitlistService.getMine({ id: (await entryOf(1)).id, accountId: customer(1) })).toMatchObject({ position: 1 });

    const [notification] = await notificationsFor(0, 'WAITLIST_SEAT_AVAILABLE');
    expect(notification.channels).toEqual(['IN_APP', 'EMAIL']);
    expect(notification.data).toMatchObject({ seats: ['A3'], offerMinutes: 15, movie: 'Dune: Part Three', waitlistId: first.id });
    expect(notification.body).toContain('A3');
    expect(await notificationsFor(1)).toHaveLength(0);
  });

  it("uses the branch's WAITLIST_OFFER_TIME", async () => {
    await systemConfigService.setValue({ key: 'WAITLIST_OFFER_TIME', branchId: ID.BRANCH, value: 5, accountId: 1 });
    await join(0);
    await freeSeat(1);
    const entry = await entryOf(0);
    expect(entry.expires_at.getTime() - entry.notified_at.getTime()).toBe(5 * MINUTE);
  });

  it('never reserves past the start of the show', async () => {
    await clearDatabase();
    await seedSoldOutShowtime({ startsInMinutes: 6 });
    await join(0);
    await freeSeat(1);
    const entry = await entryOf(0);
    const schedule = await Schedule.findOne({ id: ID.SHOWTIME });
    expect(entry.expires_at.getTime()).toBe(new Date(`${schedule.movie_date}T${schedule.time_begin}:00`).getTime());
  });

  it('serves strictly in join order: nobody overtakes a head that is still short of seats', async () => {
    await join(0, { seat_count: 2 });
    await join(1);

    await freeSeat(1);
    expect((await entryOf(0)).status).toBe(STATUS.WAITING);
    expect((await entryOf(1)).status).toBe(STATUS.WAITING);
    expect((await ticket(1)).status).toBe(Ticket.STATUS.AVAILABLE);

    await freeSeat(2);
    const head = await entryOf(0);
    expect(head.status).toBe(STATUS.NOTIFIED);
    expect(head.offered_seat_codes.sort()).toEqual(['A1', 'A2']);
    expect((await entryOf(1)).status).toBe(STATUS.WAITING);
  });

  it('never offers an out-of-service seat', async () => {
    await join(0);
    await waitlistService.processSchedule(ID.SHOWTIME);
    expect((await entryOf(0)).status).toBe(STATUS.WAITING);
    expect((await ticket(99)).status).toBe(Ticket.STATUS.AVAILABLE);
  });

  it('expires an offer nobody booked and passes its seats to the next customer', async () => {
    await join(0);
    await join(1);
    await freeSeat(1);
    const offer = await entryOf(0);

    await waitlistService.processSchedule(ID.SHOWTIME, { now: new Date(offer.expires_at.getTime() + 1000) });

    expect(await entryOf(0)).toMatchObject({ status: STATUS.EXPIRED, close_reason: 'OFFER_EXPIRED' });
    expect(await entryOf(1)).toMatchObject({ status: STATUS.NOTIFIED, offered_seat_codes: ['A1'] });
    expect(await ticket(1)).toMatchObject({ status: Ticket.STATUS.HELD, held_by: customer(1) });
    expect(await notificationsFor(0, 'WAITLIST_EXPIRED')).toHaveLength(1);
    expect(await notificationsFor(1, 'WAITLIST_SEAT_AVAILABLE')).toHaveLength(1);
  });

  it('lets an offer run out when the customer is not in the middle of paying for it', async () => {
    await join(0);
    await freeSeat(1);
    const offer = await entryOf(0);

    // A payment that has itself lapsed does not keep the offer alive.
    await bookingRepository.createPendingBooking({
      code: 'BK-LAPSED',
      accountId: customer(0),
      scheduleId: ID.SHOWTIME,
      branchId: ID.BRANCH,
      ticketIds: [1],
      totalPrice: 90000,
      expiresAt: new Date(offer.expires_at.getTime() - MINUTE),
    });
    await waitlistService.processSchedule(ID.SHOWTIME, { now: new Date(offer.expires_at.getTime() + 1000) });
    expect((await entryOf(0)).status).toBe(STATUS.EXPIRED);
    expect((await ticket(1)).status).toBe(Ticket.STATUS.AVAILABLE);
  });

  it('does not expire an offer while the customer is paying for it, and books it when they do', async () => {
    await join(0);
    await join(1);
    await freeSeat(1);
    const offer = await entryOf(0);

    await bookingRepository.createPendingBooking({
      code: 'BK-WL-1',
      accountId: customer(0),
      scheduleId: ID.SHOWTIME,
      branchId: ID.BRANCH,
      ticketIds: [1],
      totalPrice: 90000,
      expiresAt: new Date(offer.expires_at.getTime() + 10 * MINUTE),
    });
    await waitlistService.processSchedule(ID.SHOWTIME, { now: new Date(offer.expires_at.getTime() + 1000) });
    expect((await entryOf(0)).status).toBe(STATUS.NOTIFIED);
    expect((await ticket(1)).held_by).toBe(customer(0));
    expect((await entryOf(1)).status).toBe(STATUS.WAITING);

    await bookingRepository.finalizeMomoOrder('BK-WL-1', { ticketIds: [1], accountId: customer(0), totalPrice: 90000 });

    const booking = await Booking.findOne({ code: 'BK-WL-1' });
    expect(await entryOf(0)).toMatchObject({ status: STATUS.BOOKED, booking_id: booking.id });
    expect((await ticket(1)).status).toBe(Ticket.STATUS.BOOKED);
    expect((await entryOf(1)).status).toBe(STATUS.WAITING);
  });

  it('passes offered seats the customer did not book on to the next customer', async () => {
    await join(0, { seat_count: 2 });
    await join(1);
    await freeSeat(1);
    await freeSeat(2);
    expect((await entryOf(0)).offered_seat_codes.sort()).toEqual(['A1', 'A2']);

    await bookingRepository.finalizeMomoOrder('BK-WL-2', { ticketIds: [1], accountId: customer(0), totalPrice: 90000 });

    expect((await entryOf(0)).status).toBe(STATUS.BOOKED);
    expect(await entryOf(1)).toMatchObject({ status: STATUS.NOTIFIED, offered_seat_codes: ['A2'] });
  });

  it('closes the entry of a waiting customer who books a seat on their own', async () => {
    await join(0);
    await Ticket.updateOne({ id: 4 }, { $set: { status: Ticket.STATUS.HELD, held_by: customer(0) } });
    await bookingRepository.finalizeMomoOrder('BK-SELF', { ticketIds: [4], accountId: customer(0), totalPrice: 90000 });
    expect((await entryOf(0)).status).toBe(STATUS.BOOKED);
  });

  it('gives a reserved seat back to its customer if it slips out of their hands mid-offer', async () => {
    await join(0);
    await join(1);
    await freeSeat(1);

    // e.g. they deselected it at the seat map, or their payment failed and the hold was dropped.
    await bookingRepository.releaseTickets({ scheduleId: ID.SHOWTIME, seatCodes: ['A1'], accountId: customer(0) });

    const offer = await entryOf(0);
    expect(offer.status).toBe(STATUS.NOTIFIED);
    expect(await ticket(1)).toMatchObject({ status: Ticket.STATUS.HELD, held_by: customer(0) });
    expect((await ticket(1)).held_until.getTime()).toBe(offer.expires_at.getTime());
    expect((await entryOf(1)).status).toBe(STATUS.WAITING);
  });

  it('keeps a reserved seat until the offer ends when the customer re-holds it at the seat map', async () => {
    await join(0);
    await freeSeat(1);
    const offer = await entryOf(0);
    // BOOKING_HOLD_TIME (5 min) is shorter than the 15 min offer; the hold must not shrink.
    await bookingRepository.holdTickets({
      scheduleId: ID.SHOWTIME,
      seatCodes: ['A1'],
      accountId: customer(0),
      until: new Date(Date.now() + 5 * MINUTE),
    });
    expect((await ticket(1)).held_until.getTime()).toBe(offer.expires_at.getTime());
  });

  it('serves the queue from every way a seat comes free', async () => {
    for (let n = 0; n < 4; n += 1) await join(n);

    await bookingRepository.applyRefund(await soldBooking(1));
    await bookingRepository.updateTicketStatus(2, Ticket.STATUS.AVAILABLE);
    await Ticket.updateOne({ id: 3 }, { $set: { status: Ticket.STATUS.HELD, held_by: 999, held_until: new Date(Date.now() - 1000) } });
    await bookingRepository.expireAllHeldTickets();

    expect((await entryOf(0)).offered_seat_codes).toEqual(['A1']);
    expect((await entryOf(1)).offered_seat_codes).toEqual(['A2']);
    expect((await entryOf(2)).offered_seat_codes).toEqual(['A3']);
    expect((await entryOf(3)).status).toBe(STATUS.WAITING);
  });

  it('sends one notification per offer, however often the queue is processed', async () => {
    await join(0);
    await freeSeat(1);
    await waitlistService.processSchedule(ID.SHOWTIME);
    await waitlistService.sweep();
    expect(await notificationsFor(0, 'WAITLIST_SEAT_AVAILABLE')).toHaveLength(1);
  });
});

describe('leaving the queue', () => {
  beforeEach(() => seedSoldOutShowtime());

  it('moves everyone behind up a place', async () => {
    const first = await join(0);
    await join(1);
    await join(2);

    const left = await waitlistService.cancelMine({ id: first.id, accountId: customer(0) });
    expect(left).toMatchObject({ status: STATUS.CANCELLED, close_reason: 'CUSTOMER_CANCELLED' });
    expect(await waitlistService.getMine({ id: (await entryOf(1)).id, accountId: customer(1) })).toMatchObject({ position: 1 });
    expect(await waitlistService.getMine({ id: (await entryOf(2)).id, accountId: customer(2) })).toMatchObject({ position: 2 });
    expect(socket.emitToAccount).toHaveBeenCalledWith(customer(2), 'waitlist:updated', expect.anything());
  });

  it('passes the seats of a declined offer straight to the next customer', async () => {
    await join(0);
    await join(1);
    await freeSeat(1);
    const offer = await entryOf(0);

    await waitlistService.cancelMine({ id: offer.id, accountId: customer(0) });

    expect((await entryOf(0)).status).toBe(STATUS.CANCELLED);
    expect(await entryOf(1)).toMatchObject({ status: STATUS.NOTIFIED, offered_seat_codes: ['A1'] });
  });

  it('refuses to cancel an entry that is already closed', async () => {
    const entry = await join(0);
    await waitlistService.cancelMine({ id: entry.id, accountId: customer(0) });
    await expect(waitlistService.cancelMine({ id: entry.id, accountId: customer(0) })).rejects.toMatchObject({
      code: 'WAITLIST_NOT_ACTIVE',
      status: 409,
      extra: { status: STATUS.CANCELLED },
    });
  });
});

describe('closing a queue', () => {
  beforeEach(() => seedSoldOutShowtime());

  it('closes every entry of a cancelled showtime and releases what was reserved', async () => {
    await join(0);
    await join(1);
    await freeSeat(1);
    await Schedule.updateOne({ id: ID.SHOWTIME }, { $set: { status: 'CANCELLED' } });

    await waitlistService.sweep();

    expect(await entryOf(0)).toMatchObject({ status: STATUS.CANCELLED, close_reason: 'SHOWTIME_CANCELLED' });
    expect(await entryOf(1)).toMatchObject({ status: STATUS.CANCELLED, close_reason: 'SHOWTIME_CANCELLED' });
    expect((await ticket(1)).status).toBe(Ticket.STATUS.AVAILABLE);
    expect(await notificationsFor(0, 'WAITLIST_CANCELLED')).toHaveLength(1);
    expect(await notificationsFor(1, 'WAITLIST_CANCELLED')).toHaveLength(1);
  });

  it('expires the entries still waiting when the show starts', async () => {
    await join(0);
    await waitlistService.sweep({ now: new Date(Date.now() + 4 * 60 * MINUTE) });
    expect(await entryOf(0)).toMatchObject({ status: STATUS.EXPIRED, close_reason: 'SHOWTIME_STARTED' });
    const [notification] = await notificationsFor(0, 'WAITLIST_EXPIRED');
    expect(notification.body).toContain('started before a seat came free');
  });
});

describe("a customer never reaches someone else's waitlist", () => {
  beforeEach(() => seedSoldOutShowtime());

  it('answers 404 for an entry that is not theirs, and changes nothing', async () => {
    const theirs = await join(1);
    await expectRefusal(waitlistService.getMine({ id: theirs.id, accountId: customer(0) }), 'WAITLIST_NOT_FOUND', 404);
    await expectRefusal(waitlistService.cancelMine({ id: theirs.id, accountId: customer(0) }), 'WAITLIST_NOT_FOUND', 404);
    expect((await entryOf(1)).status).toBe(STATUS.WAITING);
  });

  it('lists and reports only their own entries', async () => {
    await join(0);
    await join(1);
    const { data, total } = await waitlistService.listMine({ accountId: customer(0) });
    expect(total).toBe(1);
    expect(data[0]).toMatchObject({ schedule_id: ID.SHOWTIME, position: 1 });

    const status = await waitlistService.getShowtimeStatus({ scheduleId: ID.SHOWTIME, accountId: customer(1) });
    expect(status.entry).toMatchObject({ position: 2 });
    expect(status.waiting_count).toBe(2);
  });
});

describe('getShowtimeStatus', () => {
  beforeEach(() => seedSoldOutShowtime());

  it('reports a sold-out showtime the customer can queue for', async () => {
    expect(await waitlistService.getShowtimeStatus({ scheduleId: ID.SHOWTIME, accountId: customer(0) })).toEqual({
      schedule_id: ID.SHOWTIME,
      total_seats: 6,
      available_seats: 0,
      full: true,
      waiting_count: 0,
      max_seat_count: 8,
      offer_minutes: 15,
      can_join: true,
      reason: null,
      entry: null,
    });
  });

  it('says why a customer cannot queue', async () => {
    await Ticket.updateOne({ id: 1 }, { $set: { status: Ticket.STATUS.AVAILABLE } });
    const status = await waitlistService.getShowtimeStatus({ scheduleId: ID.SHOWTIME, accountId: customer(0) });
    expect(status).toMatchObject({ full: false, available_seats: 1, can_join: false, reason: { code: 'SHOWTIME_NOT_FULL' } });
  });
});
