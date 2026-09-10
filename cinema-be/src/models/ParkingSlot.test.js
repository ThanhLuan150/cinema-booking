const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const ParkingSlot = require('./ParkingSlot');

beforeAll(async () => {
  await connect();
  await ParkingSlot.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, parking_area_id: 1, slot_code: 'B1-042', vehicle_type: 'CAR', ...overrides };
}

describe('ParkingSlot model', () => {
  it('creates a valid slot and defaults status to AVAILABLE', async () => {
    const slot = await ParkingSlot.create(baseFields());
    expect(slot.status).toBe('AVAILABLE');
    expect(slot.vehicle_type).toBe('CAR');
  });

  it('defaults vehicle_type to CAR', async () => {
    const slot = await ParkingSlot.create({ id: 2, parking_area_id: 1, slot_code: 'B1-043' });
    expect(slot.vehicle_type).toBe('CAR');
  });

  it('fails validation when required fields are missing', () => {
    const err = new ParkingSlot({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.parking_area_id).toBeDefined();
    expect(err.errors.slot_code).toBeDefined();
  });

  it('rejects an invalid status and vehicle_type', () => {
    expect(new ParkingSlot(baseFields({ status: 'FULL' })).validateSync().errors.status).toBeDefined();
    expect(new ParkingSlot(baseFields({ vehicle_type: 'PLANE' })).validateSync().errors.vehicle_type).toBeDefined();
  });

  it('allows the same slot_code in different areas', async () => {
    await ParkingSlot.create(baseFields());
    await expect(ParkingSlot.create(baseFields({ id: 2, parking_area_id: 2 }))).resolves.toBeDefined();
  });

  it('rejects a duplicate slot_code within the same area', async () => {
    await ParkingSlot.create(baseFields());
    await expect(ParkingSlot.create(baseFields({ id: 2 }))).rejects.toThrow();
  });

  it('exposes STATUSES and VEHICLE_TYPES', () => {
    expect(ParkingSlot.STATUSES).toEqual(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']);
    expect(ParkingSlot.VEHICLE_TYPES).toContain('MOTORBIKE');
  });
});
