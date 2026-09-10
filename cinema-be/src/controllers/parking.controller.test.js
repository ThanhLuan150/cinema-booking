const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const parkingController = require('./parking.controller');
const parkingRepository = require('../repositories/parking.repository');
const ParkingArea = require('../models/ParkingArea');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingTicket = require('../models/ParkingTicket');
const { PARKING_RATES } = require('../services/parkingFee');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedBranch1() {
  await ParkingArea.create({ id: 1, branch_id: 1, name: 'B1', capacity: 10, status: 'ACTIVE' });
  await ParkingSlot.create({ id: 1, parking_area_id: 1, slot_code: 'B1-001', vehicle_type: 'CAR', status: 'AVAILABLE' });
}

describe('parking.controller — areas & slots', () => {
  it('rejects an area with no name / a negative capacity', async () => {
    let res = mockRes();
    await parkingController.createArea({ body: {}, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = mockRes();
    await parkingController.createArea({ body: { name: 'X', capacity: -3 }, branchId: 1 }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates an area on the caller-scoped branch', async () => {
    const res = mockRes();
    await parkingController.createArea({ body: { name: 'Rooftop', capacity: 50 }, branchId: 7 }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].branch_id).toBe(7);
  });

  it('refuses to delete an area that still has slots', async () => {
    await seedBranch1();
    const res = mockRes();
    await parkingController.removeArea({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('AREA_HAS_SLOTS');
  });

  it('rejects a duplicate slot_code in the same area but allows it in another', async () => {
    await ParkingArea.create([
      { id: 1, branch_id: 1, name: 'A1', capacity: 5, status: 'ACTIVE' },
      { id: 2, branch_id: 1, name: 'A2', capacity: 5, status: 'ACTIVE' },
    ]);
    await ParkingSlot.create({ id: 50, parking_area_id: 1, slot_code: 'S-1', vehicle_type: 'CAR', status: 'AVAILABLE' });

    let res = mockRes();
    await parkingController.createSlot({ body: { parking_area_id: 1, slot_code: 'S-1' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);

    res = mockRes();
    await parkingController.createSlot({ body: { parking_area_id: 2, slot_code: 'S-1' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('will not flip an OCCUPIED slot via updateSlot', async () => {
    await seedBranch1();
    await ParkingSlot.updateOne({ id: 1 }, { status: 'OCCUPIED' });
    const res = mockRes();
    await parkingController.updateSlot({ params: { id: 1 }, body: { status: 'MAINTENANCE' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('SLOT_OCCUPIED');
  });
});

describe('parking.controller — vehicle flow', () => {
  it('runs the full happy path: enter -> exit (fee) -> payment (slot released)', async () => {
    await seedBranch1();

    // Enter
    let res = mockRes();
    await parkingController.enterVehicle(
      { branchId: 1, body: { vehicle_type: 'CAR', vehicle_plate: '51f-123.45' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const ticket = res.json.mock.calls[0][0];
    expect(ticket.status).toBe('ACTIVE');
    expect(ticket.ticket_code).toMatch(/^PK-/);
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('OCCUPIED');

    // backdate entry so the fee is deterministic: ~90min -> first block + 1 started hour
    await ParkingTicket.updateOne({ id: ticket.id }, { entry_at: new Date(Date.now() - 90 * 60 * 1000) });

    // Exit
    res = mockRes();
    await parkingController.exitVehicle({ params: { id: ticket.id } }, res);
    const exited = res.json.mock.calls[0][0];
    expect(exited.status).toBe('PENDING_PAYMENT');
    expect(exited.exit_at).toBeTruthy();
    expect(exited.fee).toBe(PARKING_RATES.CAR.firstBlockFee + PARKING_RATES.CAR.hourlyFee);
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('OCCUPIED'); // not released yet

    // Payment
    res = mockRes();
    await parkingController.payTicket({ params: { id: ticket.id } }, res);
    const paid = res.json.mock.calls[0][0];
    expect(paid.status).toBe('COMPLETED');
    expect(paid.paid_at).toBeTruthy();
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('AVAILABLE'); // released
  });

  it('auto-assigns a free slot for the vehicle type when none is given', async () => {
    await ParkingArea.create({ id: 1, branch_id: 1, name: 'B1', capacity: 10, status: 'ACTIVE' });
    await ParkingSlot.create([
      { id: 1, parking_area_id: 1, slot_code: 'M-1', vehicle_type: 'MOTORBIKE', status: 'AVAILABLE' },
      { id: 2, parking_area_id: 1, slot_code: 'C-1', vehicle_type: 'CAR', status: 'AVAILABLE' },
    ]);
    const res = mockRes();
    await parkingController.enterVehicle({ branchId: 1, body: { vehicle_type: 'CAR', vehicle_plate: 'ABC' } }, res);
    expect(res.json.mock.calls[0][0].slot_id).toBe(2);
  });

  it('returns 409 PARKING_FULL when there is no free slot for the vehicle type', async () => {
    await ParkingArea.create({ id: 1, branch_id: 1, name: 'B1', capacity: 10, status: 'ACTIVE' });
    await ParkingSlot.create({ id: 1, parking_area_id: 1, slot_code: 'C-1', vehicle_type: 'CAR', status: 'OCCUPIED' });
    const res = mockRes();
    await parkingController.enterVehicle({ branchId: 1, body: { vehicle_type: 'CAR', vehicle_plate: 'ABC' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('PARKING_FULL');
  });

  it('rejects an explicit slot from another branch / of the wrong vehicle type', async () => {
    await ParkingArea.create([
      { id: 1, branch_id: 1, name: 'B1', capacity: 5, status: 'ACTIVE' },
      { id: 2, branch_id: 2, name: 'B2', capacity: 5, status: 'ACTIVE' },
    ]);
    await ParkingSlot.create([
      { id: 1, parking_area_id: 2, slot_code: 'x', vehicle_type: 'CAR', status: 'AVAILABLE' },
      { id: 2, parking_area_id: 1, slot_code: 'y', vehicle_type: 'MOTORBIKE', status: 'AVAILABLE' },
    ]);

    let res = mockRes();
    await parkingController.enterVehicle({ branchId: 1, body: { vehicle_type: 'CAR', vehicle_plate: 'A', slot_id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].code).toBe('PARKING_BRANCH_MISMATCH');

    res = mockRes();
    await parkingController.enterVehicle({ branchId: 1, body: { vehicle_type: 'CAR', vehicle_plate: 'A', slot_id: 2 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('SLOT_VEHICLE_TYPE_MISMATCH');
  });

  it('compensates the slot claim when the ticket insert fails', async () => {
    await seedBranch1();
    const spy = jest
      .spyOn(parkingRepository, 'createTicket')
      .mockRejectedValueOnce(new Error('boom'));

    const res = mockRes();
    await expect(
      parkingController.enterVehicle({ branchId: 1, body: { vehicle_type: 'CAR', vehicle_plate: 'A' } }, res),
    ).rejects.toThrow('boom');

    // slot must have been released back to AVAILABLE
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('AVAILABLE');
    spy.mockRestore();
  });

  it('a second exit on the same ticket is a 409, not a re-priced fee', async () => {
    await seedBranch1();
    const t = await ParkingTicket.create({
      id: 1, ticket_code: 'PK-X', branch_id: 1, slot_id: 1, vehicle_type: 'CAR', vehicle_plate: 'A',
      entry_at: new Date(Date.now() - 30 * 60 * 1000), status: 'ACTIVE',
    });
    await ParkingSlot.updateOne({ id: 1 }, { status: 'OCCUPIED' });

    let res = mockRes();
    await parkingController.exitVehicle({ params: { id: t.id } }, res);
    expect(res.json.mock.calls[0][0].status).toBe('PENDING_PAYMENT');

    res = mockRes();
    await parkingController.exitVehicle({ params: { id: t.id } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('TICKET_NOT_ACTIVE');
  });

  it('cancel voids an ACTIVE ticket, releases the slot and zeroes the fee', async () => {
    await seedBranch1();
    await ParkingSlot.updateOne({ id: 1 }, { status: 'OCCUPIED' });
    const t = await ParkingTicket.create({
      id: 1, ticket_code: 'PK-C', branch_id: 1, slot_id: 1, vehicle_type: 'CAR', vehicle_plate: 'A', status: 'ACTIVE',
    });

    const res = mockRes();
    await parkingController.cancelTicket({ params: { id: t.id } }, res);
    const cancelled = res.json.mock.calls[0][0];
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.fee).toBe(0);
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('AVAILABLE');
  });

  it('payment before exit is a 409', async () => {
    await seedBranch1();
    const t = await ParkingTicket.create({
      id: 1, ticket_code: 'PK-P', branch_id: 1, slot_id: 1, vehicle_type: 'CAR', vehicle_plate: 'A', status: 'ACTIVE',
    });
    const res = mockRes();
    await parkingController.payTicket({ params: { id: t.id } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('TICKET_NOT_PENDING_PAYMENT');
  });

  it('requires vehicle_type and vehicle_plate on entry', async () => {
    await seedBranch1();
    let res = mockRes();
    await parkingController.enterVehicle({ branchId: 1, body: { vehicle_plate: 'A' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);

    res = mockRes();
    await parkingController.enterVehicle({ branchId: 1, body: { vehicle_type: 'CAR' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
