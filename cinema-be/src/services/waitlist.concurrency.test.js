jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed
jest.mock('../utils/mailer', () => ({
  sendInvoiceEmail: jest.fn().mockResolvedValue({}),
  sendNotificationEmail: jest.fn().mockResolvedValue({ messageId: 'x' }),
}));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { ID, customer, seedSoldOutShowtime, soldBooking } = require('../../tests/waitlistFixtures');
const waitlistService = require('./waitlist.service');
const systemConfigService = require('./systemConfig.service');
const waitlistRepository = require('../repositories/waitlist.repository');
const bookingRepository = require('../repositories/booking.repository');
const Notification = require('../models/Notification');
const Ticket = require('../models/Ticket');
const Waitlist = require('../models/Waitlist');
const WaitlistLock = require('../models/WaitlistLock');

const ROUNDS = 5;
const { STATUS } = Waitlist;

beforeAll(async () => {
  await connect();
  await Promise.all([Waitlist.init(), WaitlistLock.init(), Notification.init()]);
});
beforeEach(() => systemConfigService.invalidateAll());
afterEach(async () => {
  await clearDatabase();
  jest.restoreAllMocks();
});
afterAll(async () => closeDatabase());

const join = (n, seatCount = 1) =>
  waitlistService.join({ accountId: customer(n), body: { schedule_id: ID.SHOWTIME, seat_count: seatCount } });
const freeSeat = async (seatNumber) => bookingRepository.cancelBooking(await soldBooking(seatNumber));
const range = (n) => Array.from({ length: n }, (_, i) => i);

async function queueSnapshot() {
  return Waitlist.find({ schedule_id: ID.SHOWTIME }).sort({ id: 1 });
}

// The invariants every scenario must end in. Returns the entries in join order.
async function assertQueueIntegrity() {
  const entries = await queueSnapshot();
  const offered = entries.filter((e) => e.status === STATUS.NOTIFIED);

  // Strictly in join order: once someone is still WAITING, nobody after them has been served.
  const firstWaiting = entries.findIndex((e) => e.status === STATUS.WAITING);
  if (firstWaiting >= 0) {
    expect(entries.slice(firstWaiting + 1).filter((e) => e.status === STATUS.NOTIFIED)).toEqual([]);
  }

  // No seat offered twice, and each offer is exactly its party's size.
  const allOffered = offered.flatMap((e) => e.offered_ticket_ids);
  expect(new Set(allOffered).size).toBe(allOffered.length);
  for (const entry of offered) {
    expect(entry.offered_ticket_ids).toHaveLength(entry.seat_count);
    const tickets = await Ticket.find({ id: { $in: entry.offered_ticket_ids } });
    for (const t of tickets) {
      expect(t).toMatchObject({ status: Ticket.STATUS.HELD, held_by: entry.account_id });
      expect(t.held_until.getTime()).toBe(entry.expires_at.getTime());
    }
  }

  // Nothing is left held for a waitlist customer outside their offer.
  const waitlistAccounts = entries.map((e) => e.account_id);
  const heldForQueue = await Ticket.find({ status: Ticket.STATUS.HELD, held_by: { $in: waitlistAccounts } });
  expect(heldForQueue.map((t) => t.id).sort()).toEqual([...allOffered].sort());

  // One notification per offer ever made (an offer since declined was still announced), to the right customer.
  const everOffered = entries.filter((e) => e.notified_at);
  const notes = await Notification.find({ type: 'WAITLIST_SEAT_AVAILABLE' });
  expect(notes.map((n) => n.account_id).sort()).toEqual(everOffered.map((e) => e.account_id).sort());

  // And the lease is back.
  const lock = await WaitlistLock.findOne({ schedule_id: ID.SHOWTIME });
  if (lock) expect(lock.owner).toBeNull();

  return entries;
}

describe('many seats released at once', () => {
  it.each(range(ROUNDS))('hands N simultaneous releases to the first N customers in line (round %i)', async () => {
    await seedSoldOutShowtime({ seats: 6 });
    for (const n of range(8)) await join(n);

    await Promise.all([1, 2, 3, 4, 5].map(freeSeat));

    const entries = await assertQueueIntegrity();
    expect(entries.map((e) => e.status)).toEqual([...Array(5).fill(STATUS.NOTIFIED), ...Array(3).fill(STATUS.WAITING)]);
    expect(entries.flatMap((e) => e.offered_seat_codes).sort()).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
  });

  it.each(range(ROUNDS))('serves parties of different sizes in order and stops at a head it cannot seat (round %i)', async () => {
    await seedSoldOutShowtime({ seats: 8 });
    const sizes = [2, 1, 3, 1, 2];
    for (const n of range(sizes.length)) await join(n, sizes[n]);

    // 5 seats: 2 + 1 for the first two parties, then a party of 3 with only 2 left — it waits, and so
    // does everyone behind it.
    await Promise.all([1, 2, 3, 4, 5].map(freeSeat));

    const entries = await assertQueueIntegrity();
    expect(entries.map((e) => e.status)).toEqual([STATUS.NOTIFIED, STATUS.NOTIFIED, STATUS.WAITING, STATUS.WAITING, STATUS.WAITING]);
    expect(await Ticket.countDocuments({ id: { $in: [1, 2, 3, 4, 5] }, status: Ticket.STATUS.AVAILABLE })).toBe(2);

    // One more seat and the party of 3 is seated — still ahead of the party of 1 behind it.
    await freeSeat(6);
    const after = await assertQueueIntegrity();
    expect(after.map((e) => e.status)).toEqual([STATUS.NOTIFIED, STATUS.NOTIFIED, STATUS.NOTIFIED, STATUS.WAITING, STATUS.WAITING]);
  });

  it.each(range(ROUNDS))('stays consistent when every kind of release lands together (round %i)', async () => {
    await seedSoldOutShowtime({ seats: 6 });
    for (const n of range(7)) await join(n);
    // Seats 5 and 6 sit in a lapsed hold and an unpaid checkout instead of a paid booking.
    const past = new Date(Date.now() - 1000);
    await Ticket.updateOne({ id: 5 }, { $set: { status: Ticket.STATUS.HELD, held_by: 900, held_until: past } });
    await Ticket.updateOne({ id: 6 }, { $set: { status: Ticket.STATUS.HELD, held_by: 901, held_until: new Date(Date.now() + 60000) } });

    await Promise.all([
      freeSeat(1),
      soldBooking(2).then((b) => bookingRepository.applyRefund(b)),
      bookingRepository.updateTicketStatus(3, Ticket.STATUS.AVAILABLE),
      soldBooking(4).then((b) => bookingRepository.changeBookingShowtime(b, { newScheduleId: 999, newTicketIds: [] })),
      bookingRepository.expireAllHeldTickets(),
      bookingRepository.releaseTickets({ scheduleId: ID.SHOWTIME, seatCodes: ['A6'], accountId: 901 }),
    ]);

    const entries = await assertQueueIntegrity();
    expect(entries.map((e) => e.status)).toEqual([...Array(6).fill(STATUS.NOTIFIED), STATUS.WAITING]);
  });

  it.each(range(ROUNDS))('never lets the seat map and the waitlist both win a seat (round %i)', async () => {
    await seedSoldOutShowtime({ seats: 6 });
    for (const n of range(6)) await join(n);
    const seatCodes = ['A1', 'A2', 'A3', 'A4'];

    // Four seats come free while four shoppers at the seat map grab at those same four seats.
    await Promise.all([
      ...[1, 2, 3, 4].map(freeSeat),
      ...[0, 1, 2, 3].map((i) =>
        bookingRepository.holdTickets({
          scheduleId: ID.SHOWTIME,
          seatCodes: [seatCodes[i]],
          accountId: 800 + i,
          until: new Date(Date.now() + 5 * 60000),
        }),
      ),
    ]);

    const entries = await assertQueueIntegrity();
    const offeredIds = entries.flatMap((e) => e.offered_ticket_ids);
    const tickets = await Ticket.find({ id: { $in: [1, 2, 3, 4] } });
    for (const t of tickets) {
      if (offeredIds.includes(t.id)) continue;
      // Not offered: either a shopper holds it, or it is free — never someone in the queue.
      expect(t.held_by === null || t.held_by >= 800).toBe(true);
    }
  });

  it.each(range(ROUNDS))('gives each seat out once however many runs start at the same moment (round %i)', async () => {
    await seedSoldOutShowtime({ seats: 6 });
    for (const n of range(8)) await join(n);
    // Freed behind the hooks' back, so only the runs below can hand them out.
    await Ticket.updateMany({ id: { $in: [1, 2, 3, 4, 5] } }, { $set: { status: Ticket.STATUS.AVAILABLE } });

    await Promise.all([...range(20).map(() => waitlistService.processSchedule(ID.SHOWTIME)), waitlistService.sweep()]);

    const entries = await assertQueueIntegrity();
    expect(entries.filter((e) => e.status === STATUS.NOTIFIED).map((e) => e.account_id)).toEqual(range(5).map(customer));
  });

  it.each(range(ROUNDS))('hands a declined offer on cleanly while other seats are being released (round %i)', async () => {
    await seedSoldOutShowtime({ seats: 6 });
    for (const n of range(5)) await join(n);
    await freeSeat(1);
    const offer = await Waitlist.findOne({ account_id: customer(0) });
    expect(offer.status).toBe(STATUS.NOTIFIED);

    await Promise.all([
      waitlistService.cancelMine({ id: offer.id, accountId: customer(0) }),
      freeSeat(2),
      freeSeat(3),
    ]);

    const entries = await assertQueueIntegrity();
    expect(entries.map((e) => e.status)).toEqual([
      STATUS.CANCELLED,
      STATUS.NOTIFIED,
      STATUS.NOTIFIED,
      STATUS.NOTIFIED,
      STATUS.WAITING,
    ]);
    expect(await Ticket.countDocuments({ held_by: customer(0) })).toBe(0);
  });
});

describe('joining at the same moment', () => {
  it('lets one customer in once, however many joins they send together', async () => {
    await seedSoldOutShowtime();
    const results = await Promise.allSettled(range(10).map(() => join(0)));

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const refusals = results.filter((r) => r.status === 'rejected').map((r) => r.reason.code);
    expect(refusals).toEqual(Array(9).fill('WAITLIST_DUPLICATE'));
    expect(await Waitlist.countDocuments({ account_id: customer(0) })).toBe(1);
  });

  it('gives simultaneous joiners distinct places', async () => {
    await seedSoldOutShowtime();
    await Promise.all(range(10).map((n) => join(n)));
    const positions = await Promise.all(
      (await queueSnapshot()).map((e) => waitlistService.getMine({ id: e.id, accountId: e.account_id })),
    );
    expect(positions.map((v) => v.position).sort((a, b) => a - b)).toEqual(range(10).map((i) => i + 1));
  });
});

describe('the per-showtime lease', () => {
  it('does not lose a release that lands while another run holds the lease', async () => {
    await seedSoldOutShowtime();
    await join(0);
    await join(1);
    await Ticket.updateOne({ id: 1 }, { $set: { status: Ticket.STATUS.AVAILABLE } });

    // Hold the first run at the moment it is about to give the lease back.
    let openGate;
    const gate = new Promise((resolve) => {
      openGate = resolve;
    });
    let reachedGate;
    const atGate = new Promise((resolve) => {
      reachedGate = resolve;
    });
    const realRelease = waitlistRepository.releaseLock;
    jest.spyOn(waitlistRepository, 'releaseLock').mockImplementationOnce(async (...args) => {
      reachedGate();
      await gate;
      return realRelease(...args);
    });

    const firstRun = waitlistService.processSchedule(ID.SHOWTIME);
    await atGate;
    expect((await Waitlist.findOne({ account_id: customer(0) })).status).toBe(STATUS.NOTIFIED);

    // A second seat comes free now: its run finds the lease taken and asks for another pass.
    await freeSeat(2);
    expect((await Waitlist.findOne({ account_id: customer(1) })).status).toBe(STATUS.WAITING);
    expect(await WaitlistLock.findOne({ schedule_id: ID.SHOWTIME })).toMatchObject({ rerun: true });

    openGate();
    await firstRun;

    await assertQueueIntegrity();
    expect(await Waitlist.findOne({ account_id: customer(1) })).toMatchObject({ status: STATUS.NOTIFIED, offered_seat_codes: ['A2'] });
  });

  it('takes over a lease left behind by a run that died', async () => {
    await seedSoldOutShowtime();
    await join(0);
    await WaitlistLock.create({ schedule_id: ID.SHOWTIME, owner: 'crashed', locked_until: new Date(Date.now() + 60000) });

    // While the dead lease is live, the release is parked...
    await freeSeat(1);
    expect((await Waitlist.findOne({ account_id: customer(0) })).status).toBe(STATUS.WAITING);

    // ...and served by the sweep once it has run out.
    await WaitlistLock.updateOne({ schedule_id: ID.SHOWTIME }, { $set: { locked_until: new Date(Date.now() - 1000) } });
    await waitlistService.sweep();
    await assertQueueIntegrity();
    expect((await Waitlist.findOne({ account_id: customer(0) })).status).toBe(STATUS.NOTIFIED);
  });

  it('gives the lease back when a run fails part-way, and still announces what it did', async () => {
    await seedSoldOutShowtime();
    await join(0);
    await join(1);
    await Ticket.updateMany({ id: { $in: [1, 2] } }, { $set: { status: Ticket.STATUS.AVAILABLE } });
    const realFindHead = waitlistRepository.findHead;
    let calls = 0;
    jest.spyOn(waitlistRepository, 'findHead').mockImplementation(async (...args) => {
      calls += 1;
      if (calls === 2) throw new Error('database went away');
      return realFindHead(...args);
    });

    await expect(waitlistService.processSchedule(ID.SHOWTIME)).rejects.toThrow('database went away');

    expect(await WaitlistLock.findOne({ schedule_id: ID.SHOWTIME })).toMatchObject({ owner: null });
    expect(await Notification.countDocuments({ type: 'WAITLIST_SEAT_AVAILABLE', account_id: customer(0) })).toBe(1);
  });
});
