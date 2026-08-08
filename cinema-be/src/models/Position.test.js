const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Position = require('./Position');

beforeAll(async () => {
  await connect();
  await Position.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Position model', () => {
  it('creates a valid position with defaults', async () => {
    const position = await Position.create({ id: 1, code: 'TICKET_STAFF', name: 'Ticket Staff' });
    expect(position.status).toBe(1);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Position({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.name).toBeDefined();
  });

  it('enforces unique code', async () => {
    await Position.create({ id: 1, code: 'TICKET_STAFF', name: 'Ticket Staff' });
    await expect(Position.create({ id: 2, code: 'TICKET_STAFF', name: 'Ticket Staff (dup)' })).rejects.toThrow();
  });

  it('accepts a position code that is not one of the 7 minimum positions', async () => {
    // Position.code is intentionally not a mongoose enum — adding a future position like
    // CASHIER must not require a schema change.
    const position = await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier' });
    expect(position.code).toBe('CASHIER');
  });
});
