const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const dashboardController = require('./dashboard.controller');
const Cinema = require('../models/Cinema');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Account = require('../models/Account');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('ownerDashboard', () => {
  it('rejects a branchId the caller does not own', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A' });
    const res = mockRes();
    await dashboardController.ownerDashboard(
      { query: { branchId: '999' }, account: { role: 2, accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns scoped stats for the owner\'s cinemas', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A', status: 1 });
    const res = mockRes();
    await dashboardController.ownerDashboard({ query: {}, account: { role: 2, accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ cinemas: [{ id: 1, name: 'A', status: 1 }] }),
    );
  });
});

describe('adminDashboard', () => {
  it('returns system-wide totals and revenue', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', role: 1 });
    await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
    await Invoice.create({
      id: 1,
      ticket_id: 1,
      account_id: 1,
      code: 'A',
      total_price: 50000,
      status: 1,
      createdAt: new Date('2026-01-01'),
    });

    const res = mockRes();
    await dashboardController.adminDashboard({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalRevenue: 50000, totalUsers: 1, totalTransactions: 1 }),
    );
  });
});
