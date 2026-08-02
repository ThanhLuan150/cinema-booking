const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const userRepository = require('./user.repository');
const Account = require('../models/Account');
const Cinema = require('../models/Cinema');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('user.repository', () => {
  it('findById returns the account', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    expect((await userRepository.findById(1)).email).toBe('a@b.com');
  });

  it('updateOwnProfile updates the given fields', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const updated = await userRepository.updateOwnProfile(1, { name: 'Alice' });
    expect(updated.name).toBe('Alice');
  });

  it('findAll paginates accounts, newest id first', async () => {
    await Account.create([
      { id: 1, email: 'a@b.com', password: 'x' },
      { id: 2, email: 'c@d.com', password: 'x' },
    ]);
    const result = await userRepository.findAll({ skip: 0, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe(2);
  });

  it('remove deletes the account', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    await userRepository.remove(1);
    expect(await Account.countDocuments()).toBe(0);
  });

  it('updateFields updates arbitrary fields', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', status: 1 });
    const updated = await userRepository.updateFields(1, { status: 0 });
    expect(updated.status).toBe(0);
  });

  it('approveOwnedPendingCinemas approves only that owner\'s pending cinemas', async () => {
    await Cinema.create([
      { id: 1, owner_id: 42, name: 'A', status: 0 },
      { id: 2, owner_id: 42, name: 'B', status: 1 },
      { id: 3, owner_id: 99, name: 'C', status: 0 },
    ]);
    await userRepository.approveOwnedPendingCinemas(42);
    const cinemas = await Cinema.find().sort({ id: 1 });
    expect(cinemas.map((c) => c.status)).toEqual([1, 1, 0]);
  });
});
