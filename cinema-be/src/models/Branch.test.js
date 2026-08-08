const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Branch = require('./Branch');

beforeAll(async () => {
  await connect();
  await Branch.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Branch model', () => {
  it('creates a valid branch and applies defaults', async () => {
    const branch = await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'Branch A', code: 'BR-A' });
    expect(branch.address).toBe('');
    expect(branch.city).toBe('');
    expect(branch.phone).toBe('');
    expect(branch.email).toBe('');
    expect(branch.images).toEqual([]);
    expect(branch.opening_time).toBe('');
    expect(branch.closing_time).toBe('');
    expect(branch.status).toBe('ACTIVE');
    expect(branch.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Branch({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.company_id).toBeDefined();
    expect(err.errors.owner_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.code).toBeDefined();
  });

  it('rejects a status outside the allowed enum', () => {
    const err = new Branch({
      id: 1,
      company_id: 1,
      owner_id: 1,
      name: 'A',
      code: 'BR-A',
      status: 'PENDING',
    }).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'BR-A' });
    await expect(Branch.create({ id: 1, company_id: 1, owner_id: 2, name: 'B', code: 'BR-B' })).rejects.toThrow();
  });

  it('enforces unique code', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'BR-A' });
    await expect(Branch.create({ id: 2, company_id: 1, owner_id: 1, name: 'B', code: 'BR-A' })).rejects.toThrow();
  });

  it('stores an array of image URLs', async () => {
    const branch = await Branch.create({
      id: 1,
      company_id: 1,
      owner_id: 1,
      name: 'A',
      code: 'BR-A',
      images: ['a.jpg', 'b.jpg'],
    });
    expect(branch.images).toEqual(['a.jpg', 'b.jpg']);
  });

  it('toJSON strips _id and __v', async () => {
    const branch = await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'BR-A' });
    const json = branch.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
