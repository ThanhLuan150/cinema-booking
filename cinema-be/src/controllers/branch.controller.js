const bcrypt = require('bcryptjs');
const branchRepository = require('../repositories/branch.repository');
const companyRepository = require('../repositories/company.repository');
const nextId = require('../utils/nextId');
const { emitToOwner } = require('../utils/socket');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const SUPER_ADMIN_UPDATE_FIELDS = [
  'company_id',
  'name',
  'code',
  'address',
  'city',
  'phone',
  'email',
  'images',
  'opening_time',
  'closing_time',
];
// A Branch Admin may edit their own branch's contact/operating details, but never its
// company assignment, code, or ownership — that would be changing their own branch scope.
const BRANCH_ADMIN_UPDATE_FIELDS = [
  'name',
  'address',
  'city',
  'phone',
  'email',
  'images',
  'opening_time',
  'closing_time',
];

// GET /api/cinema?page=&limit= -> public list of active branches (customer-facing "choose branch" filter)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await branchRepository.findActive({ skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/cinema/mine?page=&limit= -> Super Admin sees every branch (view all branches);
// a Branch Admin only sees the branch(es) assigned to them.
async function mine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await branchRepository.findMine({
    role: req.account.role,
    accountId: req.account.accountId,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/cinema/top -> active branches ranked by ticket booking volume, enriched with the
// average customer rating across the movies they've screened (public, for the homepage).
async function top(req, res) {
  const result = await branchRepository.getTopRanked();
  res.json(result);
}

// GET /api/cinema/favorites/mine -> branches the caller has favorited (auth required)
async function favoritesMine(req, res) {
  const result = await branchRepository.findFavoriteBranchesByAccountId(req.account.accountId);
  res.json(result);
}

// GET /api/cinema/:id/favorite -> favorite count for that branch (public)
async function favoriteCount(req, res) {
  const count = await branchRepository.countFavorites(req.params.id);
  res.json(count);
}

// POST /api/cinema/favorite { cinema_id } (auth required)
async function favorite(req, res) {
  const { cinema_id } = req.body;
  if (cinema_id === undefined) return res.status(400).json({ message: 'cinema_id is required' });

  const existing = await branchRepository.findFavorite({ branchId: cinema_id, accountId: req.account.accountId });
  if (existing) return res.status(200).json(existing);

  const id = await nextId('favoriteCinema');
  const favoriteDoc = await branchRepository.createFavorite({
    id,
    branchId: cinema_id,
    accountId: req.account.accountId,
  });
  res.status(201).json(favoriteDoc);
}

// POST /api/cinema/unfavorite { cinema_id } (auth required)
async function unfavorite(req, res) {
  const { cinema_id } = req.body;
  if (cinema_id === undefined) return res.status(400).json({ message: 'cinema_id is required' });

  await branchRepository.deleteFavorite({ branchId: cinema_id, accountId: req.account.accountId });
  res.json({ message: 'Unfavorited' });
}

// GET /api/cinema/:id -> public detail (active branches only — an inactive or under-maintenance
// branch is never publicly visible, only reachable by its own admin via GET /cinema/mine)
async function getById(req, res) {
  const branch = await branchRepository.findActiveById(req.params.id);
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  res.json(branch);
}

// GET /api/cinema/:id/detail -> full branch info regardless of status (branch.read permission,
// branch-scoped via requireBranchAccess) — "View branch information" for Super Admin (any
// branch) or the assigned Branch Admin/staffed Employee (their own branch only).
async function getAdminDetail(req, res) {
  res.json(req.branch);
}

// POST /api/cinema/branch-admin { email, password, name, phone, company_id, cinema_name, code,
// address, city, phone, email, opening_time, closing_time } (branchAdmin.create permission —
// super admin only). Provisions a Branch Admin account and their first branch together,
// pre-approved — replaces the old self-registration + OTP + admin-approval onboarding flow
// with direct, centralized provisioning.
async function createBranchAdmin(req, res) {
  const {
    email,
    password,
    name,
    phone,
    company_id,
    cinema_name,
    code,
    address,
    city,
    opening_time,
    closing_time,
  } = req.body;
  if (!email || !password || !cinema_name || !company_id || !code) {
    return res
      .status(400)
      .json({ message: 'email, password, cinema_name, company_id and code are required' });
  }

  const company = await companyRepository.findById(company_id);
  if (!company) return res.status(400).json({ message: 'Invalid company_id', code: 'INVALID_COMPANY' });

  const normalizedEmail = String(email).toLowerCase();
  const existing = await branchRepository.findAccountByEmail(normalizedEmail);
  if (existing) return res.status(409).json({ message: 'Email already exists', code: 'EMAIL_ALREADY_EXISTS' });

  const accountId = await nextId('account');
  const hashed = await bcrypt.hash(password, 10);
  const account = await branchRepository.createOwnerAccount({
    id: accountId,
    email: normalizedEmail,
    password: hashed,
    name,
    phone,
  });

  const branchId = await nextId('cinema');
  const branch = await branchRepository.create({
    id: branchId,
    company_id: Number(company_id),
    owner_id: account.id,
    name: cinema_name,
    code,
    address: address || '',
    city: city || '',
    phone: phone || '',
    email: normalizedEmail,
    images: [],
    opening_time: opening_time || '',
    closing_time: closing_time || '',
    status: 'ACTIVE',
  });

  res.status(201).json({ ...branch.toJSON(), owner_email: account.email, owner_name: account.name });
}

// POST /api/cinema { company_id, name, code, address, city, phone, email, images,
// opening_time, closing_time, owner_id } (branch.create permission — super admin only)
async function create(req, res) {
  const { company_id, name, code, address, city, phone, email, images, opening_time, closing_time, owner_id } =
    req.body;
  if (!company_id || !name || !code) {
    return res.status(400).json({ message: 'company_id, name and code are required' });
  }

  const company = await companyRepository.findById(company_id);
  if (!company) return res.status(400).json({ message: 'Invalid company_id', code: 'INVALID_COMPANY' });

  const id = await nextId('cinema');
  const branch = await branchRepository.create({
    id,
    company_id: Number(company_id),
    owner_id: owner_id ? Number(owner_id) : req.account.accountId,
    name,
    code,
    address: address || '',
    city: city || '',
    phone: phone || '',
    email: email || '',
    images: Array.isArray(images) ? images : [],
    opening_time: opening_time || '',
    closing_time: closing_time || '',
    status: 'ACTIVE',
  });
  res.status(201).json(branch);
}

// PUT /api/cinema/:id (branch.update permission, branch-scoped) — Super Admin may update any
// field including company assignment; a Branch Admin may only edit their own branch's
// contact/operating details, never its company, code, or ownership.
async function update(req, res) {
  const allowedFields = req.permissionScope === 'ALL' ? SUPER_ADMIN_UPDATE_FIELDS : BRANCH_ADMIN_UPDATE_FIELDS;
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }

  if (updates.company_id !== undefined) {
    const company = await companyRepository.findById(updates.company_id);
    if (!company) return res.status(400).json({ message: 'Invalid company_id', code: 'INVALID_COMPANY' });
    updates.company_id = Number(updates.company_id);
  }

  const branch = await branchRepository.updateFields(req.params.id, updates);
  res.json(branch);
}

// PUT /api/cinema/:id/activate (branch.activate permission — super admin only)
async function activate(req, res) {
  const branch = await branchRepository.setStatus(req.params.id, 'ACTIVE');
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  emitToOwner(branch.owner_id, 'branch:activated', branch);
  res.json(branch);
}

// PUT /api/cinema/:id/disable (branch.disable permission — super admin only)
async function disable(req, res) {
  const branch = await branchRepository.setStatus(req.params.id, 'INACTIVE');
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  emitToOwner(branch.owner_id, 'branch:disabled', branch);
  res.json(branch);
}

// PUT /api/cinema/:id/maintenance (branch.disable permission — super admin only)
async function maintenance(req, res) {
  const branch = await branchRepository.setStatus(req.params.id, 'MAINTENANCE');
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  emitToOwner(branch.owner_id, 'branch:maintenance', branch);
  res.json(branch);
}

// PUT /api/cinema/:id/assign-admin { account_id } (branch.assignAdmin permission — super admin
// only) — assigns an existing account as this branch's Branch Admin, independent of branch
// creation (e.g. reassigning a branch to a different admin).
async function assignAdmin(req, res) {
  const { account_id } = req.body;
  if (!account_id) return res.status(400).json({ message: 'account_id is required' });

  const branch = await branchRepository.assignAdmin(req.params.id, account_id);
  if (!branch) return res.status(404).json({ message: 'Branch not found' });
  res.json(branch);
}

// DELETE /api/cinema/:id (branch.delete permission — super admin only) — refuses to delete a
// branch that still has active employees or rooms attached ("delete when allowed").
async function remove(req, res) {
  const branch = await branchRepository.findById(req.params.id);
  if (!branch) return res.status(404).json({ message: 'Branch not found' });

  const blocked = await branchRepository.hasDependents(req.params.id);
  if (blocked) {
    return res.status(409).json({
      message: 'Cannot delete a branch with active employees or rooms. Deactivate or reassign them first.',
      code: 'BRANCH_HAS_DEPENDENTS',
    });
  }

  await branchRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = {
  list,
  mine,
  top,
  favoritesMine,
  favoriteCount,
  favorite,
  unfavorite,
  getById,
  getAdminDetail,
  createBranchAdmin,
  create,
  update,
  activate,
  disable,
  maintenance,
  assignAdmin,
  remove,
};
