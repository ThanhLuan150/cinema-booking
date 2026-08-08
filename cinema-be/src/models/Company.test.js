const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Company = require('./Company');

beforeAll(async () => {
  await connect();
  await Company.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Company model', () => {
  it('creates a valid company and applies defaults', async () => {
    const company = await Company.create({ id: 1, name: 'Acme Cinemas', code: 'ACME' });
    expect(company.address).toBe('');
    expect(company.phone).toBe('');
    expect(company.email).toBe('');
    expect(company.status).toBe('ACTIVE');
    expect(company.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Company({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.code).toBeDefined();
  });

  it('rejects a status outside the allowed enum', () => {
    const err = new Company({ id: 1, name: 'A', code: 'A', status: 'BLOCKED' }).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Company.create({ id: 1, name: 'A', code: 'A' });
    await expect(Company.create({ id: 1, name: 'B', code: 'B' })).rejects.toThrow();
  });

  it('enforces unique code', async () => {
    await Company.create({ id: 1, name: 'A', code: 'DUP' });
    await expect(Company.create({ id: 2, name: 'B', code: 'DUP' })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const company = await Company.create({ id: 1, name: 'A', code: 'A' });
    const json = company.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
