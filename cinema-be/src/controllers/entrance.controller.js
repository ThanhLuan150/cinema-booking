const entranceRepository = require('../repositories/entrance.repository');
const Entrance = require('../models/Entrance');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const STATUSES = Entrance.STATUSES;

// GET /api/entrance?branchId=&status=&page=&limit= (entrance.read, branch-scoped by the route's
// resolveListAccess -> req.branchId; null means an ALL-scope caller asked for every branch).
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (req.query.status && STATUSES.includes(req.query.status)) filter.status = req.query.status;

  const { data, total } = await entranceRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/entrance/:id (entrance.read, branch-scoped)
async function getById(req, res) {
  const entrance = await entranceRepository.findById(req.params.id);
  if (!entrance) return res.status(404).json({ message: 'Entrance not found' });
  res.json(entrance);
}

// POST /api/entrance { branch_id, name, code?, status? } (entrance.create, branch-scoped)
async function create(req, res) {
  const branch_id = req.branchId;
  const name = req.body.name ? String(req.body.name).trim() : '';
  if (!name) return res.status(400).json({ message: 'name is required' });

  const code = req.body.code ? String(req.body.code).trim() : '';
  if (code && (await entranceRepository.findByBranchAndCode(branch_id, code))) {
    return res.status(409).json({ message: 'An entrance with this code already exists in this branch', code: 'ENTRANCE_CODE_TAKEN' });
  }

  let status = 'ACTIVE';
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    status = req.body.status;
  }

  const id = await nextId('entrance');
  const entrance = await entranceRepository.create({ id, branch_id, name, code, status });
  res.status(201).json(entrance);
}

// PUT /api/entrance/:id { name?, code?, status? } (entrance.update, branch-scoped)
async function update(req, res) {
  const entrance = await entranceRepository.findById(req.params.id);
  if (!entrance) return res.status(404).json({ message: 'Entrance not found' });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ message: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.code !== undefined) {
    const code = String(req.body.code).trim();
    if (code && (await entranceRepository.findByBranchAndCode(entrance.branch_id, code, { excludeId: entrance.id }))) {
      return res.status(409).json({ message: 'An entrance with this code already exists in this branch', code: 'ENTRANCE_CODE_TAKEN' });
    }
    updates.code = code;
  }
  if (req.body.status !== undefined) {
    if (!STATUSES.includes(req.body.status)) {
      return res.status(400).json({ message: `status must be one of ${STATUSES.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updates.status = req.body.status;
  }

  const updated = await entranceRepository.updateFields(entrance.id, updates);
  res.json(updated);
}

// DELETE /api/entrance/:id (entrance.delete, branch-scoped) — refused while a scanner is still
// pinned here, which would otherwise leave a dangling entrance_id.
async function remove(req, res) {
  const entrance = await entranceRepository.findById(req.params.id);
  if (!entrance) return res.status(404).json({ message: 'Entrance not found' });

  const deviceCount = await entranceRepository.countDevices(entrance.id);
  if (deviceCount > 0) {
    return res.status(409).json({ message: 'Detach the scanners pinned to this entrance first', code: 'ENTRANCE_HAS_DEVICES' });
  }

  await entranceRepository.remove(entrance.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
