jest.mock('../models/Branch', () => ({ find: jest.fn() }));
jest.mock('../models/Employee', () => ({ findOne: jest.fn() }));

const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const { ROLE, ROOM, resolveBranchIdsForAccount, resolveRoomsForAccount } = require('./socketRooms');

// The model calls are `.find(...).lean()` / `.findOne(...).lean()`, so each mock returns a thenable-free
// stub whose lean() resolves to the rows.
const lean = (rows) => ({ lean: () => Promise.resolve(rows) });

beforeEach(() => {
  jest.clearAllMocks();
  Branch.find.mockReturnValue(lean([]));
  Employee.findOne.mockReturnValue(lean(null));
});

describe('resolveBranchIdsForAccount', () => {
  it('returns every branch a Branch Admin owns', async () => {
    Branch.find.mockReturnValue(lean([{ id: 3 }, { id: 4 }]));

    await expect(resolveBranchIdsForAccount({ accountId: 42, role: ROLE.BRANCH_ADMIN })).resolves.toEqual([3, 4]);
    expect(Branch.find).toHaveBeenCalledWith({ owner_id: 42 }, { id: 1 });
    expect(Employee.findOne).not.toHaveBeenCalled();
  });

  it('returns the single branch an active Employee is staffed at', async () => {
    Employee.findOne.mockReturnValue(lean({ branch_id: 7 }));

    await expect(resolveBranchIdsForAccount({ accountId: 9, role: ROLE.EMPLOYEE })).resolves.toEqual([7]);
    expect(Employee.findOne).toHaveBeenCalledWith({ user_id: 9, status: 1 }, { branch_id: 1 });
  });

  it('returns nothing for a deactivated employee (no active staffing row)', async () => {
    await expect(resolveBranchIdsForAccount({ accountId: 9, role: ROLE.EMPLOYEE })).resolves.toEqual([]);
  });

  // Branch rooms carry operational data (check-ins, cash drawers, maintenance). A customer must
  // never end up in one, so the role is checked before any lookup happens at all.
  it('never resolves branches for a customer', async () => {
    Branch.find.mockReturnValue(lean([{ id: 3 }]));

    await expect(resolveBranchIdsForAccount({ accountId: 1, role: ROLE.CUSTOMER })).resolves.toEqual([]);
    expect(Branch.find).not.toHaveBeenCalled();
  });

  it('returns nothing without an account', async () => {
    await expect(resolveBranchIdsForAccount(null)).resolves.toEqual([]);
    await expect(resolveBranchIdsForAccount({ role: ROLE.EMPLOYEE })).resolves.toEqual([]);
  });
});

describe('resolveRoomsForAccount', () => {
  it('gives a SUPER_ADMIN the account, admin and staff rooms', async () => {
    await expect(resolveRoomsForAccount({ accountId: 1, role: ROLE.SUPER_ADMIN })).resolves.toEqual([
      'account:1',
      'admin',
      'staff',
    ]);
  });

  // A super admin sees every branch through the `admin` room that emitBranchEvent also targets,
  // so joining hundreds of branch rooms would only duplicate their events.
  it('does not put a SUPER_ADMIN into branch rooms', async () => {
    Branch.find.mockReturnValue(lean([{ id: 3 }]));

    const rooms = await resolveRoomsForAccount({ accountId: 1, role: ROLE.SUPER_ADMIN });
    expect(rooms).not.toContain('branch:3');
  });

  it('gives a Branch Admin their owner room plus a room per owned branch', async () => {
    Branch.find.mockReturnValue(lean([{ id: 3 }, { id: 4 }]));

    await expect(resolveRoomsForAccount({ accountId: 42, role: ROLE.BRANCH_ADMIN })).resolves.toEqual([
      'account:42',
      'owner:42',
      'staff',
      'branch:3',
      'branch:4',
    ]);
  });

  it('gives an Employee the staff room and their own branch', async () => {
    Employee.findOne.mockReturnValue(lean({ branch_id: 7 }));

    await expect(resolveRoomsForAccount({ accountId: 9, role: ROLE.EMPLOYEE })).resolves.toEqual([
      'account:9',
      'staff',
      'branch:7',
    ]);
  });

  it('gives a customer only their own account room', async () => {
    await expect(resolveRoomsForAccount({ accountId: 5, role: ROLE.CUSTOMER })).resolves.toEqual(['account:5']);
  });

  it('returns nothing for an anonymous socket', async () => {
    await expect(resolveRoomsForAccount(null)).resolves.toEqual([]);
    await expect(resolveRoomsForAccount({ role: ROLE.CUSTOMER })).resolves.toEqual([]);
  });
});

describe('ROOM', () => {
  it('builds the room names the emit helpers address', () => {
    expect(ROOM.admin()).toBe('admin');
    expect(ROOM.staff()).toBe('staff');
    expect(ROOM.owner(1)).toBe('owner:1');
    expect(ROOM.account(2)).toBe('account:2');
    expect(ROOM.branch(3)).toBe('branch:3');
    expect(ROOM.schedule(4)).toBe('schedule:4');
  });
});
