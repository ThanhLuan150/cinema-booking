jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const waitlistRepository = require('./waitlist.repository');
const Ticket = require('../models/Ticket');
const WaitlistLock = require('../models/WaitlistLock');
const socket = require('../utils/socket');

beforeAll(async () => {
  await connect();
  await WaitlistLock.init();
});
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

const seatRow = (id, status = Ticket.STATUS.AVAILABLE, extra = {}) => ({
  id,
  schedule_id: 7,
  seat_index: id,
  seat_code: `A${id}`,
  status,
  ...extra,
});

describe('claimSeats', () => {
  it('takes the lowest free seats, skipping out-of-service ones', async () => {
    await Ticket.create([seatRow(1), seatRow(2, Ticket.STATUS.BOOKED), seatRow(3), seatRow(4)]);
    const until = new Date(Date.now() + 60000);
    const claimed = await waitlistRepository.claimSeats({ scheduleId: 7, accountId: 10, count: 2, until, excludeSeatCodes: ['A1'] });
    expect(claimed.map((t) => t.seat_code)).toEqual(['A3', 'A4']);
    expect(await Ticket.findOne({ id: 3 })).toMatchObject({ status: Ticket.STATUS.HELD, held_by: 10 });
  });

  it('never gives one seat to two simultaneous claimants', async () => {
    await Ticket.create([seatRow(1), seatRow(2), seatRow(3)]);
    const until = new Date(Date.now() + 60000);
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => waitlistRepository.claimSeats({ scheduleId: 7, accountId: 10 + i, count: 1, until })),
    );
    const won = results.flat();
    expect(won).toHaveLength(3);
    expect(new Set(won.map((t) => t.id)).size).toBe(3);
  });
});

describe('releaseSeats', () => {
  it("frees only the customer's own holds, and announces only those", async () => {
    await Ticket.create([
      seatRow(1, Ticket.STATUS.HELD, { held_by: 10 }),
      seatRow(2, Ticket.STATUS.HELD, { held_by: 11 }),
      seatRow(3, Ticket.STATUS.BOOKED),
      seatRow(4, Ticket.STATUS.HELD, { held_by: 10 }),
    ]);
    const released = await waitlistRepository.releaseSeats([1, 2, 3, 4], 10, { exceptTicketIds: [4] });
    expect(released.map((t) => t.id)).toEqual([1]);
    expect((await Ticket.findOne({ id: 2 })).held_by).toBe(11);
    expect((await Ticket.findOne({ id: 4 })).status).toBe(Ticket.STATUS.HELD);
    expect(socket.emitToSchedule).toHaveBeenCalledWith(7, 'seat:updated', { scheduleId: 7, seatCodes: ['A1'], status: 'AVAILABLE' });
  });
});

describe('the per-showtime lease', () => {
  it('goes to one caller at a time', async () => {
    const owners = ['a', 'b', 'c', 'd', 'e'];
    const won = await Promise.all(owners.map((owner) => waitlistRepository.acquireLock(7, owner)));
    expect(won.filter(Boolean)).toHaveLength(1);
  });

  it('is released, or handed back for another pass when one was asked for', async () => {
    expect(await waitlistRepository.acquireLock(7, 'a')).toBe(true);
    expect(await waitlistRepository.requestRerun(7)).toBe(true);
    expect(await waitlistRepository.releaseLock(7, 'a')).toBe('rerun');
    expect(await WaitlistLock.findOne({ schedule_id: 7 })).toMatchObject({ owner: 'a', rerun: false });
    expect(await waitlistRepository.releaseLock(7, 'a')).toBe('released');
    expect(await waitlistRepository.acquireLock(7, 'b')).toBe(true);
  });

  it('cannot be asked for a rerun when nobody holds it', async () => {
    expect(await waitlistRepository.requestRerun(7)).toBe(false);
    await waitlistRepository.acquireLock(7, 'a');
    await waitlistRepository.releaseLock(7, 'a');
    expect(await waitlistRepository.requestRerun(7)).toBe(false);
  });

  it('runs out, and a holder whose lease was taken over is told so', async () => {
    await WaitlistLock.create({ schedule_id: 7, owner: 'a', locked_until: new Date(Date.now() - 1) });
    expect(await waitlistRepository.acquireLock(7, 'b')).toBe(true);
    expect(await waitlistRepository.releaseLock(7, 'a')).toBe('lost');
    expect((await WaitlistLock.findOne({ schedule_id: 7 })).owner).toBe('b');
  });
});
