const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const ParkingArea = require('./ParkingArea');

beforeAll(async () => {
  await connect();
  await ParkingArea.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, branch_id: 1, name: 'Basement B1', capacity: 120, ...overrides };
}

describe('ParkingArea model', () => {
  it('creates a valid area and defaults status to ACTIVE', async () => {
    const area = await ParkingArea.create(baseFields());
    expect(area.status).toBe('ACTIVE');
    expect(area.capacity).toBe(120);
    expect(area.createdAt).toBeInstanceOf(Date);
  });

  it('defaults capacity to 0 when omitted', async () => {
    const area = await ParkingArea.create({ id: 2, branch_id: 1, name: 'Rooftop' });
    expect(area.capacity).toBe(0);
  });

  it('fails validation when required fields are missing', () => {
    const err = new ParkingArea({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('rejects a negative capacity', () => {
    const err = new ParkingArea(baseFields({ capacity: -1 })).validateSync();
    expect(err.errors.capacity).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new ParkingArea(baseFields({ status: 'CLOSED' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id', async () => {
    await ParkingArea.create(baseFields());
    await expect(ParkingArea.create(baseFields({ branch_id: 2 }))).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const json = (await ParkingArea.create(baseFields())).toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
