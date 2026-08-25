jest.mock('../utils/socket', () => ({ emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitToAccount: jest.fn(), emitPublic: jest.fn() }));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const branchController = require('./branch.controller');
const socket = require('../utils/socket');
const Branch = require('../models/Branch');
const Company = require('../models/Company');
const Account = require('../models/Account');
const FavoriteCinema = require('../models/FavoriteCinema');
const Employee = require('../models/Employee');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

async function seedCompany(id = 1) {
  return Company.create({ id, name: 'Acme', code: `ACME${id}`, status: 'ACTIVE' });
}

describe('branch.controller list/mine/top', () => {
  it('list returns only active branches', async () => {
    await seedCompany();
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 1, name: 'Active', code: 'A', status: 'ACTIVE' },
      { id: 2, company_id: 1, owner_id: 1, name: 'Inactive', code: 'B', status: 'INACTIVE' },
    ]);
    const res = mockRes();
    await branchController.list({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('mine scopes a Branch Admin to only their own branch', async () => {
    await seedCompany();
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'Not mine', code: 'B' },
    ]);
    const res = mockRes();
    await branchController.mine({ query: {}, account: { role: 2, accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('mine returns every branch for Super Admin (view all branches)', async () => {
    await seedCompany();
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
    ]);
    const res = mockRes();
    await branchController.mine({ query: {}, account: { role: 0, accountId: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 2 }));
  });

  it('top returns the ranked list', async () => {
    const res = mockRes();
    await branchController.top({}, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('branch.controller favorites', () => {
  it('favorite creates a new favorite, then returns the existing one on repeat', async () => {
    const req = { body: { cinema_id: 1 }, account: { accountId: 42 } };
    const res1 = mockRes();
    await branchController.favorite(req, res1);
    expect(res1.status).toHaveBeenCalledWith(201);

    const res2 = mockRes();
    await branchController.favorite(req, res2);
    expect(res2.status).toHaveBeenCalledWith(200);
    expect(await FavoriteCinema.countDocuments()).toBe(1);
  });

  it('favorite rejects a missing cinema_id', async () => {
    const res = mockRes();
    await branchController.favorite({ body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('unfavorite removes the favorite', async () => {
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
    const res = mockRes();
    await branchController.unfavorite({ body: { cinema_id: 1 }, account: { accountId: 42 } }, res);
    expect(await FavoriteCinema.countDocuments()).toBe(0);
  });

  it('favoritesMine returns the caller\'s favorited branches', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'Fav', code: 'A', status: 'ACTIVE' });
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
    const res = mockRes();
    await branchController.favoritesMine({ account: { accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ name: 'Fav' })]);
  });

  it('favoriteCount returns the count for a branch', async () => {
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
    const res = mockRes();
    await branchController.favoriteCount({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(1);
  });
});

describe('branch.controller getById / getAdminDetail', () => {
  it('getById returns 404 for an unknown branch', async () => {
    const res = mockRes();
    await branchController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getById returns 404 for an inactive branch (public detail hides it)', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A', status: 'INACTIVE' });
    const res = mockRes();
    await branchController.getById({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('getById returns an active branch', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A', status: 'ACTIVE' });
    const res = mockRes();
    await branchController.getById({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'A' }));
  });

  it('getAdminDetail returns whatever branch requireBranchAccess already resolved, regardless of status', async () => {
    const branch = { id: 1, name: 'A', status: 'MAINTENANCE' };
    const res = mockRes();
    await branchController.getAdminDetail({ branch }, res);
    expect(res.json).toHaveBeenCalledWith(branch);
  });
});

describe('branch.controller createBranchAdmin', () => {
  it('rejects missing email, password, cinema_name or code', async () => {
    const res = mockRes();
    await branchController.createBranchAdmin({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('defaults to the well-known "Default Company" when company_id is omitted, creating it on first use', async () => {
    const res = mockRes();
    await branchController.createBranchAdmin(
      { body: { email: 'a@b.com', password: 'pw', cinema_name: 'A', code: 'A' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const defaultCompany = await Company.findOne({ code: 'DEFAULT' });
    expect(defaultCompany).not.toBeNull();
    const branch = await Branch.findOne({ code: 'A' });
    expect(branch.company_id).toBe(defaultCompany.id);
  });

  it('reuses the existing Default Company instead of creating a second one', async () => {
    await Company.create({ id: 5, name: 'Default Company', code: 'DEFAULT', status: 'ACTIVE' });
    const res = mockRes();
    await branchController.createBranchAdmin(
      { body: { email: 'a@b.com', password: 'pw', cinema_name: 'A', code: 'A' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(await Company.countDocuments({ code: 'DEFAULT' })).toBe(1);
    const branch = await Branch.findOne({ code: 'A' });
    expect(branch.company_id).toBe(5);
  });

  it('rejects an invalid company_id', async () => {
    const res = mockRes();
    await branchController.createBranchAdmin(
      { body: { email: 'a@b.com', password: 'pw', cinema_name: 'A', company_id: 999, code: 'A' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_COMPANY' }));
  });

  it('rejects a duplicate email', async () => {
    await seedCompany();
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x' });
    const res = mockRes();
    await branchController.createBranchAdmin(
      { body: { email: 'owner@example.com', password: 'pw', cinema_name: 'My Cinema', company_id: 1, code: 'A' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('creates a pre-approved, pre-verified branch admin account and branch', async () => {
    await seedCompany();
    const res = mockRes();
    await branchController.createBranchAdmin(
      {
        body: {
          email: 'owner@example.com',
          password: 'pw',
          name: 'Owner',
          phone: '0123456789',
          cinema_name: 'My Cinema',
          company_id: 1,
          code: 'MC-01',
          city: 'HN',
        },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);

    const account = await Account.findOne({ email: 'owner@example.com' });
    expect(account.role).toBe(2);
    expect(account.approved).toBe(true);
    expect(account.verified).toBe(true);

    const branch = await Branch.findOne({ owner_id: account.id });
    expect(branch.name).toBe('My Cinema');
    expect(branch.company_id).toBe(1);
    expect(branch.status).toBe('ACTIVE');
  });
});

describe('branch.controller create', () => {
  it('rejects missing company_id, name or code', async () => {
    const res = mockRes();
    await branchController.create({ body: {}, account: { role: 0, accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an invalid company_id', async () => {
    const res = mockRes();
    await branchController.create(
      { body: { company_id: 999, name: 'A', code: 'A' }, account: { role: 0, accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_COMPANY' }));
  });

  it('creates an active branch under the given company, owned by the caller by default', async () => {
    await seedCompany();
    const res = mockRes();
    await branchController.create(
      { body: { company_id: 1, name: 'New Branch', code: 'NB' }, account: { role: 0, accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Branch.findOne({ name: 'New Branch' });
    expect(created.status).toBe('ACTIVE');
    expect(created.company_id).toBe(1);
    expect(created.owner_id).toBe(1);
  });

  it('assigns the given owner_id when provided', async () => {
    await seedCompany();
    const res = mockRes();
    await branchController.create(
      { body: { company_id: 1, name: 'New Branch', code: 'NB', owner_id: 42 }, account: { role: 0, accountId: 1 } },
      res,
    );
    const created = await Branch.findOne({ name: 'New Branch' });
    expect(created.owner_id).toBe(42);
  });
});

describe('branch.controller update', () => {
  it('Super Admin (ALL scope) may update company_id, code and other fields', async () => {
    await seedCompany(1);
    await seedCompany(2);
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    const res = mockRes();
    await branchController.update(
      { params: { id: 1 }, body: { name: 'Updated', company_id: 2 }, permissionScope: 'ALL' },
      res,
    );
    const updated = await Branch.findOne({ id: 1 });
    expect(updated.name).toBe('Updated');
    expect(updated.company_id).toBe(2);
  });

  it('Super Admin update rejects an invalid company_id', async () => {
    await seedCompany(1);
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    const res = mockRes();
    await branchController.update(
      { params: { id: 1 }, body: { company_id: 999 }, permissionScope: 'ALL' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('Branch Admin (BRANCH scope) may edit contact fields but never company_id, code or status ("cannot change their own Branch scope")', async () => {
    await seedCompany(1);
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    const res = mockRes();
    await branchController.update(
      {
        params: { id: 1 },
        body: { name: 'Updated', phone: '0999', company_id: 2, code: 'HACKED', status: 'INACTIVE' },
        permissionScope: 'BRANCH',
      },
      res,
    );
    const updated = await Branch.findOne({ id: 1 });
    expect(updated.name).toBe('Updated');
    expect(updated.phone).toBe('0999');
    expect(updated.company_id).toBe(1);
    expect(updated.code).toBe('A');
    expect(updated.status).toBe('ACTIVE');
  });
});

describe('branch.controller activate/disable/maintenance', () => {
  it('activate returns 404 for an unknown branch', async () => {
    const res = mockRes();
    await branchController.activate({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('activate sets status to ACTIVE and notifies the owner', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A', status: 'INACTIVE' });
    const res = mockRes();
    await branchController.activate({ params: { id: 1 } }, res);
    expect((await Branch.findOne({ id: 1 })).status).toBe('ACTIVE');
    expect(socket.emitToOwner).toHaveBeenCalledWith(42, 'branch:activated', expect.anything());
  });

  it('disable sets status to INACTIVE', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A', status: 'ACTIVE' });
    const res = mockRes();
    await branchController.disable({ params: { id: 1 } }, res);
    expect((await Branch.findOne({ id: 1 })).status).toBe('INACTIVE');
  });

  it('maintenance sets status to MAINTENANCE', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A', status: 'ACTIVE' });
    const res = mockRes();
    await branchController.maintenance({ params: { id: 1 } }, res);
    expect((await Branch.findOne({ id: 1 })).status).toBe('MAINTENANCE');
  });
});

describe('branch.controller assignAdmin', () => {
  it('rejects a missing account_id', async () => {
    const res = mockRes();
    await branchController.assignAdmin({ params: { id: 1 }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for an unknown branch', async () => {
    const res = mockRes();
    await branchController.assignAdmin({ params: { id: 999 }, body: { account_id: 42 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('reassigns the branch to a new admin account', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    const res = mockRes();
    await branchController.assignAdmin({ params: { id: 1 }, body: { account_id: 77 } }, res);
    expect((await Branch.findOne({ id: 1 })).owner_id).toBe(77);
  });
});

describe('branch.controller remove', () => {
  it('returns 404 for an unknown branch', async () => {
    const res = mockRes();
    await branchController.remove({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('deletes a branch with no dependents', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    const res = mockRes();
    await branchController.remove({ params: { id: 1 } }, res);
    expect(await Branch.countDocuments()).toBe(0);
  });

  it('refuses to delete a branch that still has an active employee ("delete when allowed")', async () => {
    await seedCompany();
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });
    const res = mockRes();
    await branchController.remove({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BRANCH_HAS_DEPENDENTS' }));
    expect(await Branch.countDocuments()).toBe(1);
  });
});
