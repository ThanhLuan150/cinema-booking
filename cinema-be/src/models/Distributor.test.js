const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Distributor = require('./Distributor');

beforeAll(async () => {
  await connect();
  await Distributor.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Distributor model', () => {
  it('creates a valid distributor and applies defaults', async () => {
    const d = await Distributor.create({ id: 1, name: 'CGV', code: 'cgv' });
    expect(d.status).toBe('ACTIVE');
    expect(d.contact_email).toBe('');
    expect(d.phone).toBe('');
    expect(d.code).toBe('CGV'); // uppercased
  });

  it('fails validation when required fields are missing', () => {
    const err = new Distributor({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.code).toBeDefined();
  });

  it('enforces unique code', async () => {
    await Distributor.create({ id: 1, name: 'A', code: 'DUP' });
    await expect(Distributor.create({ id: 2, name: 'B', code: 'DUP' })).rejects.toThrow();
  });

  it('rejects an unknown status', () => {
    const err = new Distributor({ id: 1, name: 'A', code: 'A', status: 'PAUSED' }).validateSync();
    expect(err.errors.status).toBeDefined();
  });
});
