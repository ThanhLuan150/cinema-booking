const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const userController = require('./user.controller');
const Account = require('../models/Account');
const Cinema = require('../models/Cinema');
const Employee = require('../models/Employee');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('me / updateMe', () => {
  it('me returns 404 for an unknown account', async () => {
    const res = mockRes();
    await userController.me({ account: { accountId: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('me returns a shaped profile', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', name: 'Alice', role: 1 });
    const res = mockRes();
    await userController.me({ account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith({
      user_id: 1,
      email: 'a@b.com',
      name: 'Alice',
      phone: '',
      avatar: '',
      role: 1,
    });
  });

  it('me includes cinema_id for an employee account', async () => {
    await Account.create({ id: 1, email: 'staff@b.com', password: 'x', role: 3 });
    await Employee.create({ id: 1, account_id: 1, cinema_id: 5 });
    const res = mockRes();
    await userController.me({ account: { accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ cinema_id: 5 }));
  });

  it('updateMe only updates whitelisted fields', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 1 });
    const res = mockRes();
    await userController.updateMe({ account: { accountId: 1 }, body: { name: 'New Name', role: 0 } }, res);
    const account = await Account.findOne({ id: 1 });
    expect(account.name).toBe('New Name');
    expect(account.role).toBe(1);
  });
});

describe('list / getById / remove', () => {
  it('list paginates all accounts', async () => {
    await Account.create([
      { id: 1, email: 'a@b.com', password: 'x' },
      { id: 2, email: 'c@d.com', password: 'x' },
    ]);
    const res = mockRes();
    await userController.list({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('getById returns 404 for an unknown user', async () => {
    const res = mockRes();
    await userController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('remove deletes the account', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x' });
    const res = mockRes();
    await userController.remove({ params: { id: 1 } }, res);
    expect(await Account.countDocuments()).toBe(0);
  });
});

describe('block / unblock', () => {
  it('block sets status to 0', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', status: 1 });
    const res = mockRes();
    await userController.block({ params: { id: 1 } }, res);
    expect((await Account.findOne({ id: 1 })).status).toBe(0);
  });

  it('unblock defaults to status 1', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', status: 0 });
    const res = mockRes();
    await userController.unblock({ params: { id: 1 }, body: {} }, res);
    expect((await Account.findOne({ id: 1 })).status).toBe(1);
  });

  it('unblock returns 404 for an unknown user', async () => {
    const res = mockRes();
    await userController.unblock({ params: { id: 999 }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('approve', () => {
  it('approves the account and, for theater staff, their pending cinemas', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 2, approved: false });
    await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 0 });
    const res = mockRes();
    await userController.approve({ params: { id: 1 } }, res);
    expect((await Account.findOne({ id: 1 })).approved).toBe(true);
    expect((await Cinema.findOne({ id: 1 })).status).toBe(1);
  });

  it('does not touch cinemas for a non-theater-staff account', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 1, approved: false });
    const res = mockRes();
    await userController.approve({ params: { id: 1 } }, res);
    expect((await Account.findOne({ id: 1 })).approved).toBe(true);
  });

  it('returns 404 for an unknown account', async () => {
    const res = mockRes();
    await userController.approve({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('updateRole', () => {
  it('rejects an invalid role', async () => {
    const res = mockRes();
    await userController.updateRole({ params: { id: 1 }, body: { role: 5 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('updates the role and marks the account approved', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 1, approved: true });
    const res = mockRes();
    await userController.updateRole({ params: { id: 1 }, body: { role: 2 } }, res);
    const account = await Account.findOne({ id: 1 });
    expect(account.role).toBe(2);
    expect(account.approved).toBe(true);
  });
});
