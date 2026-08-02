const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Account = require('./Account');

beforeAll(async () => {
  await connect();
  await Account.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Account model', () => {
  it('creates a valid account and round-trips fields/defaults', async () => {
    const account = await Account.create({ id: 1, email: 'User@Example.com', password: 'secret' });
    expect(account.email).toBe('user@example.com'); // lowercased
    expect(account.name).toBe('');
    expect(account.phone).toBe('');
    expect(account.avatar).toBe('');
    expect(account.role).toBe(1);
    expect(account.status).toBe(1);
    expect(account.approved).toBe(true);
    expect(account.verified).toBe(false);
    expect(account.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const account = new Account({});
    const err = account.validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.password).toBeDefined();
  });

  it('enforces unique id and email', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await expect(Account.create({ id: 1, email: 'other@b.com', password: 'x' })).rejects.toThrow();
    await expect(Account.create({ id: 2, email: 'a@b.com', password: 'x' })).rejects.toThrow();
  });

  it('excludes select:false fields from default queries', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'secret', otp: '1234' });
    const found = await Account.findOne({ id: 1 });
    expect(found.password).toBeUndefined();
    expect(found.otp).toBeUndefined();
  });

  it('toJSON strips _id and __v', async () => {
    const account = await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const json = account.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
    expect(json.email).toBe('a@b.com');
  });
});
