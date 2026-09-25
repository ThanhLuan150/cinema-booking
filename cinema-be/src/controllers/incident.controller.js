const incidentRepository = require('../repositories/incident.repository');
const roomRepository = require('../repositories/room.repository');
const Incident = require('../models/Incident');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/incidents?branchId=&category=&severity=&page=&limit= (incident.read permission,
// branch-scoped by the route's resolveListAccess -> req.branchId)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = {};
  if (req.branchId !== null && req.branchId !== undefined) filter.branch_id = req.branchId;
  if (Incident.CATEGORIES.includes(req.query.category)) filter.category = req.query.category;
  if (Incident.SEVERITIES.includes(req.query.severity)) filter.severity = req.query.severity;

  const { data, total } = await incidentRepository.findFiltered(filter, { skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/incidents/:id (incident.read permission, branch-scoped)
async function getById(req, res) {
  const incident = await incidentRepository.findById(req.params.id);
  if (!incident) return res.status(404).json({ message: 'Incident not found' });
  res.json(incident);
}

// POST /api/incidents { branch_id, category, severity?, title, description?, room_id? }
// (incident.create permission, branch-scoped). The reporter is always the caller — never a body field.
async function create(req, res) {
  const { category, severity, title, description } = req.body;

  if (!category || !title || !String(title).trim()) {
    return res.status(400).json({ message: 'category and title are required' });
  }
  if (!Incident.CATEGORIES.includes(category)) {
    return res.status(400).json({ message: `category must be one of ${Incident.CATEGORIES.join(', ')}`, code: 'INVALID_CATEGORY' });
  }
  if (severity !== undefined && !Incident.SEVERITIES.includes(severity)) {
    return res.status(400).json({ message: `severity must be one of ${Incident.SEVERITIES.join(', ')}`, code: 'INVALID_SEVERITY' });
  }

  let room_id = null;
  if (req.body.room_id !== undefined && req.body.room_id !== null && req.body.room_id !== '') {
    const room = await roomRepository.findById(req.body.room_id);
    // A room from another branch is reported as not found rather than leaking that it exists.
    if (!room || room.cinema_id !== req.branchId) return res.status(404).json({ message: 'Room not found' });
    room_id = room.id;
  }

  const id = await nextId('incident');
  const incident = await incidentRepository.create({
    id,
    branch_id: req.branchId,
    room_id,
    category,
    severity: severity || 'LOW',
    title: String(title).trim(),
    description: description ? String(description) : '',
    reported_by: req.account.accountId,
  });
  res.status(201).json(incident);
}

module.exports = { list, getById, create };
