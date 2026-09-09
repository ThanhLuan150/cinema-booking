const distributorRepository = require('../repositories/distributor.repository');
const movieReleaseRepository = require('../repositories/movieRelease.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const CODE_RE = /^[A-Z0-9][A-Z0-9_-]{1,31}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// GET /api/distributors?status=&search=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE') filter.status = req.query.status;
  if (req.query.search) {
    const rx = new RegExp(String(req.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { code: rx }];
  }
  const { data, total } = await distributorRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/distributors/all -> unpaginated, for pickers
async function all(req, res) {
  const filter = {};
  if (req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE') filter.status = req.query.status;
  res.json(await distributorRepository.findAll(filter));
}

// GET /api/distributors/:id
async function getById(req, res) {
  const distributor = await distributorRepository.findById(req.params.id);
  if (!distributor) return res.status(404).json({ message: 'Distributor not found' });
  res.json(distributor);
}

function validatePayload(body, { partial = false } = {}) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!body.name || !String(body.name).trim()) errors.push('name is required');
  }
  if (!partial || body.code !== undefined) {
    const code = String(body.code || '').toUpperCase().trim();
    if (!CODE_RE.test(code)) errors.push('code must be 2-32 chars, letters/digits/_/- only');
  }
  if (body.contact_email !== undefined && body.contact_email !== '' && body.contact_email !== null) {
    if (!EMAIL_RE.test(String(body.contact_email).trim())) errors.push('contact_email is not a valid email');
  }
  if (body.status !== undefined && !['ACTIVE', 'INACTIVE'].includes(body.status)) {
    errors.push('status must be ACTIVE or INACTIVE');
  }
  return errors;
}

// POST /api/distributors
async function create(req, res) {
  const errors = validatePayload(req.body);
  if (errors.length) return res.status(400).json({ message: errors.join('; ') });

  const code = String(req.body.code).toUpperCase().trim();
  if (await distributorRepository.findByCode(code)) {
    return res.status(409).json({ message: 'A distributor with this code already exists', code: 'DISTRIBUTOR_CODE_TAKEN' });
  }

  const id = await nextId('distributor');
  try {
    const distributor = await distributorRepository.create({
      id,
      name: String(req.body.name).trim(),
      code,
      contact_email: req.body.contact_email ? String(req.body.contact_email).trim() : '',
      phone: req.body.phone ? String(req.body.phone).trim() : '',
      status: req.body.status || 'ACTIVE',
    });
    res.status(201).json(distributor);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A distributor with this code already exists', code: 'DISTRIBUTOR_CODE_TAKEN' });
    }
    throw err;
  }
}

// PUT /api/distributors/:id
async function update(req, res) {
  const distributor = await distributorRepository.findById(req.params.id);
  if (!distributor) return res.status(404).json({ message: 'Distributor not found' });

  const errors = validatePayload(req.body, { partial: true });
  if (errors.length) return res.status(400).json({ message: errors.join('; ') });

  const updates = {};
  if (req.body.name !== undefined) updates.name = String(req.body.name).trim();
  if (req.body.code !== undefined) {
    const code = String(req.body.code).toUpperCase().trim();
    if (code !== distributor.code) {
      const clash = await distributorRepository.findByCode(code);
      if (clash && clash.id !== distributor.id) {
        return res.status(409).json({ message: 'A distributor with this code already exists', code: 'DISTRIBUTOR_CODE_TAKEN' });
      }
    }
    updates.code = code;
  }
  if (req.body.contact_email !== undefined) updates.contact_email = req.body.contact_email ? String(req.body.contact_email).trim() : '';
  if (req.body.phone !== undefined) updates.phone = req.body.phone ? String(req.body.phone).trim() : '';
  if (req.body.status !== undefined) updates.status = req.body.status;

  try {
    const updated = await distributorRepository.updateFields(distributor.id, updates);
    res.json(updated);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'A distributor with this code already exists', code: 'DISTRIBUTOR_CODE_TAKEN' });
    }
    throw err;
  }
}

// DELETE /api/distributors/:id — blocked while any MovieRelease still points at it.
async function remove(req, res) {
  const distributor = await distributorRepository.findById(req.params.id);
  if (!distributor) return res.status(404).json({ message: 'Distributor not found' });

  if (await movieReleaseRepository.existsForDistributor(distributor.id)) {
    return res.status(409).json({
      message: 'This distributor still has movie releases and cannot be deleted. Deactivate it instead.',
      code: 'DISTRIBUTOR_IN_USE',
    });
  }

  await distributorRepository.remove(distributor.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, all, getById, create, update, remove };
