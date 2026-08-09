const companyRepository = require('../repositories/company.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/company?page=&limit= (company.read permission — super admin only)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await companyRepository.findAll({ skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/company/:id (company.read permission — super admin only)
async function getById(req, res) {
  const company = await companyRepository.findById(req.params.id);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  res.json(company);
}

// POST /api/company { name, code, address, phone, email } (company.create permission — super admin only)
async function create(req, res) {
  const { name, code, address, phone, email } = req.body;
  if (!name || !code) return res.status(400).json({ message: 'name and code are required' });

  const normalizedCode = String(code).toUpperCase();
  const existing = await companyRepository.findByCode(normalizedCode);
  if (existing) return res.status(409).json({ message: 'Company code already exists', code: 'COMPANY_CODE_EXISTS' });

  const id = await nextId('company');
  const company = await companyRepository.create({
    id,
    name,
    code: normalizedCode,
    address: address || '',
    phone: phone || '',
    email: email || '',
    status: 'ACTIVE',
  });
  res.status(201).json(company);
}

// PUT /api/company/:id { name, address, phone, email, status } (company.update permission — super admin only)
async function update(req, res) {
  const fields = ['name', 'address', 'phone', 'email', 'status'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const company = await companyRepository.updateFields(req.params.id, updates);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  res.json(company);
}

// DELETE /api/company/:id (company.delete permission — super admin only) — refuses to delete
// a company that still has branches attached.
async function remove(req, res) {
  const company = await companyRepository.findById(req.params.id);
  if (!company) return res.status(404).json({ message: 'Company not found' });

  const blocked = await companyRepository.hasBranches(req.params.id);
  if (blocked) {
    return res.status(409).json({
      message: 'Cannot delete a company with branches attached. Remove its branches first.',
      code: 'COMPANY_HAS_BRANCHES',
    });
  }

  await companyRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
