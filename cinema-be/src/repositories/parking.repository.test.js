const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const parkingRepository = require('./parking.repository');
const ParkingArea = require('../models/ParkingArea');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingTicket = require('../models/ParkingTicket');

beforeAll(async () => {
  await connect();
  await Promise.all([ParkingArea.init(), ParkingSlot.init(), ParkingTicket.init()]);
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedArea(overrides = {}) {
  return ParkingArea.create({ id: 1, branch_id: 1, name: 'B1', capacity: 10, status: 'ACTIVE', ...overrides });
}
async function seedSlot(overrides = {}) {
  return ParkingSlot.create({
    id: 1,
    parking_area_id: 1,
    slot_code: 'B1-001',
    vehicle_type: 'CAR',
    status: 'AVAILABLE',
    ...overrides,
  });
}

describe('parking.repository — slot assignment atomicity', () => {
  it('claimSlot claims an AVAILABLE slot and flips it to OCCUPIED', async () => {
    await seedArea();
    await seedSlot();
    const claimed = await parkingRepository.claimSlot(1);
    expect(claimed).not.toBeNull();
    expect(claimed.status).toBe('OCCUPIED');
  });

  it('claimSlot returns null for a slot that is not AVAILABLE', async () => {
    await seedArea();
    await seedSlot({ status: 'MAINTENANCE' });
    expect(await parkingRepository.claimSlot(1)).toBeNull();
  });

  it('a slot cannot be assigned to two vehicles at once: only one of two concurrent claims wins', async () => {
    await seedArea();
    await seedSlot();

    const [a, b] = await Promise.all([parkingRepository.claimSlot(1), parkingRepository.claimSlot(1)]);

    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
    const slot = await ParkingSlot.findOne({ id: 1 });
    expect(slot.status).toBe('OCCUPIED');
  });

  it('N-way concurrency: exactly one of many simultaneous claims wins the same slot', async () => {
    await seedArea();
    await seedSlot();

    const results = await Promise.all(
      Array.from({ length: 12 }, () => parkingRepository.claimSlot(1)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
    const slot = await ParkingSlot.findOne({ id: 1 });
    expect(slot.status).toBe('OCCUPIED');
  });

  it('releaseSlot only acts on an OCCUPIED slot and is a safe no-op otherwise', async () => {
    await seedArea();
    await seedSlot({ status: 'OCCUPIED' });
    expect(await parkingRepository.releaseSlot(1)).not.toBeNull();
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('AVAILABLE');
    // second release finds nothing to do
    expect(await parkingRepository.releaseSlot(1)).toBeNull();
  });

  it('findAssignableSlot skips non-ACTIVE areas, wrong vehicle types and taken slots', async () => {
    await ParkingArea.create([
      { id: 1, branch_id: 1, name: 'ActiveLot', capacity: 5, status: 'ACTIVE' },
      { id: 2, branch_id: 1, name: 'ClosedLot', capacity: 5, status: 'INACTIVE' },
      { id: 3, branch_id: 2, name: 'OtherBranch', capacity: 5, status: 'ACTIVE' },
    ]);
    await ParkingSlot.create([
      { id: 1, parking_area_id: 2, slot_code: 'x', vehicle_type: 'CAR', status: 'AVAILABLE' }, // closed area
      { id: 2, parking_area_id: 3, slot_code: 'x', vehicle_type: 'CAR', status: 'AVAILABLE' }, // other branch
      { id: 3, parking_area_id: 1, slot_code: 'm', vehicle_type: 'MOTORBIKE', status: 'AVAILABLE' }, // wrong type
      { id: 4, parking_area_id: 1, slot_code: 'c1', vehicle_type: 'CAR', status: 'OCCUPIED' }, // taken
      { id: 5, parking_area_id: 1, slot_code: 'c2', vehicle_type: 'CAR', status: 'AVAILABLE' }, // <- the answer
    ]);

    const slot = await parkingRepository.findAssignableSlot({ branchId: 1, vehicleType: 'CAR' });
    expect(slot.id).toBe(5);
  });

  it('findAssignableSlot returns null when the branch is full for that vehicle type', async () => {
    await seedArea();
    await seedSlot({ status: 'OCCUPIED' });
    expect(await parkingRepository.findAssignableSlot({ branchId: 1, vehicleType: 'CAR' })).toBeNull();
  });
});

describe('parking.repository — ticket lifecycle atomicity', () => {
  async function seedActiveTicket() {
    return ParkingTicket.create({
      id: 1,
      ticket_code: 'PK-1',
      branch_id: 1,
      slot_id: 1,
      vehicle_type: 'CAR',
      vehicle_plate: '51F-000.01',
      entry_at: new Date(Date.now() - 60 * 60 * 1000),
      status: 'ACTIVE',
    });
  }

  it('transitionTicket only applies while the ticket is in the expected status', async () => {
    await seedActiveTicket();
    const ok = await parkingRepository.transitionTicket(1, 'ACTIVE', { status: 'PENDING_PAYMENT', fee: 30000 });
    expect(ok.status).toBe('PENDING_PAYMENT');
    const again = await parkingRepository.transitionTicket(1, 'ACTIVE', { status: 'CANCELLED' });
    expect(again).toBeNull();
  });

  it('two concurrent exits on one ticket: exactly one transition wins', async () => {
    await seedActiveTicket();
    const [a, b] = await Promise.all([
      parkingRepository.transitionTicket(1, 'ACTIVE', { status: 'PENDING_PAYMENT', fee: 30000 }),
      parkingRepository.transitionTicket(1, 'ACTIVE', { status: 'PENDING_PAYMENT', fee: 30000 }),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    expect((await ParkingTicket.findOne({ id: 1 })).status).toBe('PENDING_PAYMENT');
  });

  it('countOpenTicketsForSlot / countOpenTicketsForArea count only ACTIVE + PENDING_PAYMENT', async () => {
    await seedArea();
    await ParkingSlot.create([
      { id: 1, parking_area_id: 1, slot_code: 'a', vehicle_type: 'CAR', status: 'OCCUPIED' },
      { id: 2, parking_area_id: 1, slot_code: 'b', vehicle_type: 'CAR', status: 'AVAILABLE' },
    ]);
    await ParkingTicket.create([
      { id: 1, ticket_code: 'PK-A', branch_id: 1, slot_id: 1, vehicle_type: 'CAR', vehicle_plate: 'A', status: 'ACTIVE' },
      { id: 2, ticket_code: 'PK-B', branch_id: 1, slot_id: 2, vehicle_type: 'CAR', vehicle_plate: 'B', status: 'COMPLETED' },
      { id: 3, ticket_code: 'PK-C', branch_id: 1, slot_id: 2, vehicle_type: 'CAR', vehicle_plate: 'C', status: 'PENDING_PAYMENT' },
    ]);
    expect(await parkingRepository.countOpenTicketsForSlot(1)).toBe(1);
    expect(await parkingRepository.countOpenTicketsForArea(1)).toBe(2);
  });
});

describe('parking.repository — branch resolution helpers', () => {
  it('resolves branch id through area, slot and ticket', async () => {
    await seedArea({ id: 7, branch_id: 3 });
    await seedSlot({ id: 4, parking_area_id: 7 });
    await ParkingTicket.create({
      id: 9, ticket_code: 'PK-Z', branch_id: 3, slot_id: 4, vehicle_type: 'CAR', vehicle_plate: 'Z', status: 'ACTIVE',
    });
    expect(await parkingRepository.findBranchIdByAreaId(7)).toBe(3);
    expect(await parkingRepository.findBranchIdBySlotId(4)).toBe(3);
    expect(await parkingRepository.findBranchIdByTicketId(9)).toBe(3);
    expect(await parkingRepository.findBranchIdByAreaId(999)).toBeNull();
  });
});
