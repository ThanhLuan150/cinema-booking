jest.mock('../repositories/branch.repository');

const branchRepository = require('../repositories/branch.repository');
const { requireBranchOwnership } = require('./ownership');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireBranchOwnership', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('responds with 404 when resolveBranchId returns null', async () => {
    const middleware = requireBranchOwnership(async () => null);
    const req = { account: { accountId: 1, role: 1 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('lets an ALL-scope caller (super admin) through without checking branch ownership', async () => {
    const middleware = requireBranchOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 0 }, permissionScope: 'ALL' };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(branchRepository.findById).not.toHaveBeenCalled();
    expect(req.branchId).toBe(5);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('responds with 404 when the branch does not exist', async () => {
    branchRepository.findById.mockResolvedValue(null);
    const middleware = requireBranchOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('responds with 403 when the account does not own the branch', async () => {
    branchRepository.findById.mockResolvedValue({ id: 5, owner_id: 99 });
    const middleware = requireBranchOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches branchId and branch then calls next for the owning account', async () => {
    const branch = { id: 5, owner_id: 1 };
    branchRepository.findById.mockResolvedValue(branch);
    const middleware = requireBranchOwnership(async () => 5);
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(req.branchId).toBe(5);
    expect(req.branch).toBe(branch);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('forwards a thrown error from resolveBranchId to next', async () => {
    const error = new Error('resolve failed');
    const middleware = requireBranchOwnership(async () => {
      throw error;
    });
    const req = { account: { accountId: 1, role: 2 } };
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
