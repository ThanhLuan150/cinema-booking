const Branch = require('../models/Branch');
const Employee = require('../models/Employee');

// Legacy Account.role numbers (see models/Role.js: legacy_role_number).
const ROLE = { SUPER_ADMIN: 0, CUSTOMER: 1, BRANCH_ADMIN: 2, EMPLOYEE: 3 };

const ROOM = {
  admin: () => 'admin',
  staff: () => 'staff',
  owner: (accountId) => `owner:${accountId}`,
  account: (accountId) => `account:${accountId}`,
  branch: (branchId) => `branch:${branchId}`,
  schedule: (scheduleId) => `schedule:${scheduleId}`,
};

// Which branches a staff account may receive branch-scoped events for. Mirrors the HTTP gate in
// middleware/permission.js#requireBranchAccess: a Branch Admin gets every branch they own, an
// Employee gets the one branch they are actively staffed at. A customer gets none — branch rooms
// carry operational data (check-ins, maintenance, cash drawers) that only staff may see.
async function resolveBranchIdsForAccount(account) {
  if (!account) return [];
  const { accountId, role } = account;
  if (role === ROLE.CUSTOMER || accountId === undefined || accountId === null) return [];

  const owned = await Branch.find({ owner_id: Number(accountId) }, { id: 1 }).lean();
  if (owned.length > 0) return owned.map((branch) => branch.id);

  const employee = await Employee.findOne({ user_id: Number(accountId), status: 1 }, { branch_id: 1 }).lean();
  return employee ? [employee.branch_id] : [];
}

// Every room a freshly authenticated socket belongs to.
async function resolveRoomsForAccount(account) {
  if (!account || account.accountId === undefined || account.accountId === null) return [];

  const { accountId, role } = account;
  const rooms = [ROOM.account(accountId)];

  if (role === ROLE.SUPER_ADMIN) rooms.push(ROOM.admin());
  if (role === ROLE.BRANCH_ADMIN) rooms.push(ROOM.owner(accountId));
  if (role !== ROLE.CUSTOMER) rooms.push(ROOM.staff());

  // SUPER_ADMIN deliberately skips branch rooms: emitBranchEvent targets `admin` as well, so
  // joining both would deliver every branch-scoped event to them twice.
  if (role !== ROLE.SUPER_ADMIN) {
    for (const branchId of await resolveBranchIdsForAccount(account)) {
      rooms.push(ROOM.branch(branchId));
    }
  }

  return rooms;
}

module.exports = { ROLE, ROOM, resolveBranchIdsForAccount, resolveRoomsForAccount };
