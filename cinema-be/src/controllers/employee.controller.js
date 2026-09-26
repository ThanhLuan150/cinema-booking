const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const employeeRepository = require('../repositories/employee.repository');
const positionRepository = require('../repositories/position.repository');
const authRepository = require('../repositories/auth.repository');
const branchRepository = require('../repositories/branch.repository');
const userRepository = require('../repositories/user.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { emitToAdmin, emitToOwner, emitToAccount } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');

// Changing someone's position changes their permissions, and deactivating them ends their access:
// the person themselves has to see that straight away (their menu and permission set are cached
// client-side), and the people managing the roster need the list refreshed. So it goes to exactly
// those audiences — the employee's own account room, the branch's Branch Admin (`owner:`) and
// Super Admin (`admin`) — and NOT to the `branch:<id>` room, which would also tell every
// colleague who was moved or deactivated. Three different sockets' rooms, so nobody gets it
// twice. Nothing account-identifying rides along, just ids. Non-throwing: a failed lookup or emit
// must never fail the change that was already saved.
async function broadcastEmployee(employee, action) {
  if (!employee) return;
  try {
    const payload = {
      action,
      id: employee.id,
      positionId: employee.position_id,
      status: employee.status,
      branchId: employee.branch_id,
    };
    const branch = await branchRepository.findById(employee.branch_id);
    emitToAdmin(REALTIME_EVENT.EMPLOYEE_UPDATED, payload);
    if (branch) emitToOwner(branch.owner_id, REALTIME_EVENT.EMPLOYEE_UPDATED, payload);
    emitToAccount(employee.user_id, REALTIME_EVENT.EMPLOYEE_UPDATED, payload);
  } catch (err) {
    console.error('[employee] failed to broadcast', employee.id, err.message);
  }
}
const { sendTempPasswordEmail } = require('../utils/mailer');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');

const EMPLOYEE_ACCOUNT_ROLE = 3;
const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Loads the employee an admin is trying to modify plus the account behind it, and refuses the
// two cases the route-level branch check cannot see:
//  - the caller acting on their own record (nobody edits their own position/status/password
//    through the admin endpoints — a Branch Admin has no Employee record, but an account that
//    somehow holds both must not be able to promote itself), and
//  - an Employee row whose account is not an ordinary EMPLOYEE (role 3). These routes must never
//    be a side door to reset the password of, or lock out, a Branch Admin or SUPER_ADMIN.
// Sends the response itself and returns null when the target may not be modified.
async function loadManageableEmployee(req, res) {
  const employee = await employeeRepository.findById(req.params.id);
  if (!employee) {
    res.status(404).json({ message: 'Employee not found' });
    return null;
  }
  const account = await authRepository.findById(employee.user_id);
  if (!account) {
    res.status(404).json({ message: 'Employee not found' });
    return null;
  }
  if (req.account && account.id === req.account.accountId) {
    res.status(403).json({ message: 'You cannot modify your own employee record', code: 'SELF_MODIFICATION_FORBIDDEN' });
    return null;
  }
  if (account.role !== EMPLOYEE_ACCOUNT_ROLE) {
    res.status(403).json({ message: 'Target account is not an employee', code: 'NOT_AN_EMPLOYEE_ACCOUNT' });
    return null;
  }
  return { employee, account };
}

function toEmployeeJson(employee, account, position) {
  return {
    ...employee.toJSON(),
    email: account?.email,
    name: account?.name,
    phone: account?.phone,
    position: position ? { code: position.code, name: position.name } : undefined,
  };
}

// GET /api/employee?branchId=&page=&limit= (branch admin: cinema-scoped; super admin: may omit
async function list(req, res) {
  const filter = req.branchId ? { branch_id: req.branchId } : {};
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await employeeRepository.findAll(filter, { skip, limit });

  const accounts = await authRepository.findByFilter({ id: { $in: data.map((e) => e.user_id) } });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const positions = await positionRepository.findAll();
  const positionById = new Map(positions.map((p) => [p.id, p]));
  const enriched = data.map((employee) =>
    toEmployeeJson(employee, accountById.get(employee.user_id), positionById.get(employee.position_id)),
  );

  res.json(buildPaginatedResult({ data: enriched, total, page, limit }));
}

// POST /api/employee { email, password, name, phone, cinema_id, position_id } (branch admin/super
async function create(req, res) {
  const { email, password, name, phone, position_id } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }
  if (!EMAIL_PATTERN.test(String(email).trim())) {
    return res.status(400).json({ message: 'email is not a valid address', code: 'INVALID_EMAIL' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      message: `password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      code: 'PASSWORD_TOO_SHORT',
    });
  }
  if (!position_id) {
    return res.status(400).json({ message: 'position_id is required' });
  }
  const position = await positionRepository.findActiveById(position_id);
  if (!position) return res.status(400).json({ message: 'Invalid position_id', code: 'INVALID_POSITION' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await authRepository.findByEmail(normalizedEmail);
  if (existing) return res.status(409).json({ message: 'Email already exists', code: 'EMAIL_ALREADY_EXISTS' });

  const accountId = await nextId('account');
  const hashed = await bcrypt.hash(password, 10);
  const account = await authRepository.createAccount({
    id: accountId,
    email: normalizedEmail,
    password: hashed,
    name: name || '',
    phone: phone || '',
    role: EMPLOYEE_ACCOUNT_ROLE,
    status: 1,
    approved: true,
    verified: true,
  });

  const employeeId = await nextId('employee');
  const employee = await employeeRepository.create({
    id: employeeId,
    user_id: account.id,
    branch_id: req.branchId,
    employee_code: `EMP-${String(employeeId).padStart(6, '0')}`,
    position_id: position.id,
    hire_date: new Date(),
  });

  await recordAudit({
    req,
    action: ACTION.CREATE_EMPLOYEE,
    entityType: ENTITY_TYPE.EMPLOYEE,
    entityId: employee.id,
    branchId: employee.branch_id,
    metadata: { employee_code: employee.employee_code, position_id: employee.position_id },
  });

  await broadcastEmployee(employee, REALTIME_ACTION.CREATED);
  res.status(201).json(toEmployeeJson(employee, account, position));
}

// PUT /api/employee/:id { position_id, status } (branch admin/super admin, cinema-scoped)
// Only position_id and status are editable here: branch_id (an Employee belongs to exactly one
// Branch) and user_id are never taken from the body.
async function update(req, res) {
  const target = await loadManageableEmployee(req, res);
  if (!target) return;
  const before = target.employee;

  const updates = {};
  if (req.body.position_id !== undefined) {
    const position = await positionRepository.findActiveById(req.body.position_id);
    if (!position) return res.status(400).json({ message: 'Invalid position_id', code: 'INVALID_POSITION' });
    updates.position_id = position.id;
  }
  if (req.body.status !== undefined) {
    const status = Number(req.body.status);
    if (![0, 1].includes(status)) {
      return res.status(400).json({ message: 'status must be 0 or 1', code: 'INVALID_STATUS' });
    }
    updates.status = status;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'position_id or status is required' });
  }

  const employee = await employeeRepository.updateFields(req.params.id, updates);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  // Deactivating locks the login and reactivating must unlock it again — remove() has always
  // locked the account, so a status-only update that left it locked would "reactivate" someone
  // who still cannot sign in.
  if (updates.status !== undefined && target.account.status !== updates.status) {
    await userRepository.updateFields(target.account.id, { status: updates.status });
  }

  const positionChanged =
    updates.position_id !== undefined && before && before.position_id !== updates.position_id;
  await recordAudit({
    req,
    action: positionChanged ? ACTION.CHANGE_EMPLOYEE_POSITION : ACTION.UPDATE_EMPLOYEE,
    entityType: ENTITY_TYPE.EMPLOYEE,
    entityId: employee.id,
    branchId: employee.branch_id,
    metadata: positionChanged
      ? { from_position_id: before.position_id, to_position_id: updates.position_id }
      : { fields: Object.keys(updates) },
  });

  const account = await authRepository.findById(employee.user_id);
  const position = await positionRepository.findById(employee.position_id);
  await broadcastEmployee(employee, REALTIME_ACTION.UPDATED);
  res.json(toEmployeeJson(employee, account, position));
}

// DELETE /api/employee/:id (branch admin/super admin, cinema-scoped) — deactivates the
// employee record and locks the underlying account instead of hard-deleting, so past
// bookings/check-ins the employee created keep a valid user_id/created_by reference.
async function remove(req, res) {
  const target = await loadManageableEmployee(req, res);
  if (!target) return;

  const employee = await employeeRepository.updateFields(req.params.id, { status: 0 });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  await userRepository.updateFields(employee.user_id, { status: 0 });

  await broadcastEmployee(employee, REALTIME_ACTION.STATUS_CHANGED);
  res.json({ message: 'Deactivated' });
}

// POST /api/employee/:id/reset-password (branch admin/super admin, cinema-scoped) — generates a
// new temporary password and emails it to the employee; never returned in the API response.
async function resetPassword(req, res) {
  const target = await loadManageableEmployee(req, res);
  if (!target) return;
  const { account } = target;

  const tempPassword = crypto.randomBytes(6).toString('hex');
  const hashed = await bcrypt.hash(tempPassword, 10);
  await userRepository.updateFields(account.id, { password: hashed });
  await sendTempPasswordEmail(account.email, tempPassword);

  res.json({ message: 'Password reset. A temporary password has been emailed to the employee.' });
}

module.exports = { list, create, update, remove, resetPassword };
