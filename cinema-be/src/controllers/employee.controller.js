const bcrypt = require('bcryptjs');
const employeeRepository = require('../repositories/employee.repository');
const authRepository = require('../repositories/auth.repository');
const userRepository = require('../repositories/user.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

function toEmployeeJson(employee, account) {
  return {
    ...employee.toJSON(),
    email: account?.email,
    name: account?.name,
    phone: account?.phone,
  };
}

// GET /api/employee?cinemaId=&page=&limit= (branch admin/super admin, cinema-scoped)
async function list(req, res) {
  const filter = { cinema_id: req.cinemaId };
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await employeeRepository.findAll(filter, { skip, limit });

  const accounts = await authRepository.findByFilter({ id: { $in: data.map((e) => e.account_id) } });
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const enriched = data.map((employee) => toEmployeeJson(employee, accountById.get(employee.account_id)));

  res.json(buildPaginatedResult({ data: enriched, total, page, limit }));
}

// POST /api/employee { email, password, name, phone, cinema_id, position } (branch admin/super admin, cinema-scoped)
async function create(req, res) {
  const { email, password, name, phone, position } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const normalizedEmail = String(email).toLowerCase();
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
    role: 3,
    status: 1,
    approved: true,
    verified: true,
  });

  const employeeId = await nextId('employee');
  const employee = await employeeRepository.create({
    id: employeeId,
    account_id: account.id,
    cinema_id: req.cinemaId,
    position: position || '',
    hire_date: new Date(),
  });

  res.status(201).json(toEmployeeJson(employee, account));
}

// PUT /api/employee/:id { position, status } (branch admin/super admin, cinema-scoped)
async function update(req, res) {
  const updates = {};
  if (req.body.position !== undefined) updates.position = req.body.position;
  if (req.body.status !== undefined) updates.status = Number(req.body.status);

  const employee = await employeeRepository.updateFields(req.params.id, updates);
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  const account = await authRepository.findById(employee.account_id);
  res.json(toEmployeeJson(employee, account));
}

// DELETE /api/employee/:id (branch admin/super admin, cinema-scoped) — deactivates the
// employee record and locks the underlying account instead of hard-deleting, so past
// bookings/check-ins the employee created keep a valid account_id/created_by reference.
async function remove(req, res) {
  const employee = await employeeRepository.updateFields(req.params.id, { status: 0 });
  if (!employee) return res.status(404).json({ message: 'Employee not found' });

  await userRepository.updateFields(employee.account_id, { status: 0 });

  res.json({ message: 'Deactivated' });
}

module.exports = { list, create, update, remove };
