const userRepository = require('../repositories/user.repository');
const employeeRepository = require('../repositories/employee.repository');
const roleRepository = require('../repositories/role.repository');
const rolePermissionRepository = require('../repositories/rolePermission.repository');
const positionRepository = require('../repositories/position.repository');
const positionPermissionRepository = require('../repositories/positionPermission.repository');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// Employees additionally need to know which cinema they're staffed at, since every
// employee-scoped endpoint (schedules, counter-sale, check-in) is filtered by it.
async function toProfileJson(account) {
  const profile = {
    user_id: account.id,
    email: account.email,
    name: account.name,
    phone: account.phone,
    avatar: account.avatar,
    role: account.role,
  };
  if (account.role === 3) {
    const employee = await employeeRepository.findByAccountId(account.id);
    if (employee) profile.cinema_id = employee.branch_id;
  }
  return profile;
}

// GET /api/user  (current authenticated account, resolved from the JWT)
async function me(req, res) {
  const account = await userRepository.findById(req.account.accountId);
  if (!account) return res.status(404).json({ message: 'Account not found' });
  res.json(await toProfileJson(account));
}

// PUT /api/user  (update the caller's own profile: name, phone, avatar)
async function updateMe(req, res) {
  const fields = ['name', 'phone', 'avatar'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const account = await userRepository.updateOwnProfile(req.account.accountId, updates);
  if (!account) return res.status(404).json({ message: 'Account not found' });
  res.json(await toProfileJson(account));
}
async function myPermissions(req, res) {
  const role = await roleRepository.findByLegacyNumber(req.account.role);
  if (!role) return res.status(403).json({ message: 'Forbidden' });

  const permissionCodes = new Set(await rolePermissionRepository.findPermissionCodesForRole(role.id));

  let positionCode = null;
  if (role.code === 'EMPLOYEE') {
    const employee = await employeeRepository.findByAccountId(req.account.accountId);
    if (employee && employee.status === 1 && employee.position_id) {
      const position = await positionRepository.findById(employee.position_id);
      if (position) {
        positionCode = position.code;
        const positionCodes = await positionPermissionRepository.findPermissionCodesForPosition(position.id);
        for (const code of positionCodes) permissionCodes.add(code);
      }
    }
  }

  res.json({ roleCode: role.code, positionCode, permissions: [...permissionCodes] });
}

// GET /api/users?page=&limit=&q= (user.read permission) — q searches name/email/phone, used by
// Customer Service to look up a customer account.
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await userRepository.findAll({ skip, limit, q: req.query.q });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/users/:id (admin only)
async function getById(req, res) {
  const account = await userRepository.findById(req.params.id);
  if (!account) return res.status(404).json({ message: 'User not found' });
  res.json(account);
}

// DELETE /api/users/:id (admin only)
async function remove(req, res) {
  await userRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

// PUT /api/block/:id (admin only)
async function block(req, res) {
  const account = await userRepository.updateFields(req.params.id, { status: 0 });
  if (!account) return res.status(404).json({ message: 'User not found' });
  res.json(account);
}

// PUT /api/unblock/:id { status: 1 } (admin only)
async function unblock(req, res) {
  const status = req.body.status !== undefined ? Number(req.body.status) : 1;
  const account = await userRepository.updateFields(req.params.id, { status });
  if (!account) return res.status(404).json({ message: 'User not found' });
  res.json(account);
}

// PUT /api/users/:id/approve (admin only) — approve a pending theater-staff account directly,
// without needing to find and approve its cinema from the Cinemas page first.
async function approve(req, res) {
  const account = await userRepository.updateFields(req.params.id, { approved: true });
  if (!account) return res.status(404).json({ message: 'User not found' });

  if (account.role === 2) {
    await userRepository.approveOwnedPendingCinemas(account.id);
  }

  res.json(account);
}

// PUT /api/users/:id/role { role } (admin only) — reassign a user's role (0=admin, 1=user, 2=theater staff)
async function updateRole(req, res) {
  const role = Number(req.body.role);
  if (![0, 1, 2].includes(role)) {
    return res.status(400).json({ message: 'role must be 0, 1 or 2' });
  }
  // An admin directly assigning a role is itself the approval — unlike self-registration,
  // there's no pending cinema whose approval would otherwise flip this back to true.
  const account = await userRepository.updateFields(req.params.id, { role, approved: true });
  if (!account) return res.status(404).json({ message: 'User not found' });
  res.json(account);
}

module.exports = { me, updateMe, myPermissions, list, getById, remove, block, unblock, approve, updateRole };
