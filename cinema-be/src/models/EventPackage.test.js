const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const EventPackage = require('./EventPackage');

beforeAll(async () => {
  await connect();
  await EventPackage.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, name: 'Premium Hall Hire', code: 'premium', base_price: 5000000, ...overrides };
}

describe('EventPackage model', () => {
  it('creates a valid package, uppercases the code and defaults status to ACTIVE', async () => {
    const pkg = await EventPackage.create(baseFields());
    expect(pkg.code).toBe('PREMIUM');
    expect(pkg.status).toBe('ACTIVE');
    expect(pkg.max_guests).toBe(0);
    expect(pkg.perks).toEqual([]);
  });

  it('fails validation when required fields are missing', () => {
    const err = new EventPackage({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.code).toBeDefined();
  });

  it('rejects a negative base_price', () => {
    const err = new EventPackage(baseFields({ base_price: -1 })).validateSync();
    expect(err.errors.base_price).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new EventPackage(baseFields({ status: 'ARCHIVED' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces a unique code', async () => {
    await EventPackage.create(baseFields());
    await expect(EventPackage.create(baseFields({ id: 2 }))).rejects.toThrow();
  });
});
