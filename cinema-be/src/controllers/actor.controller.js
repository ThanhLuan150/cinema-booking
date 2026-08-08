const actorRepository = require('../repositories/actor.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/actor?page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await actorRepository.findAll({ skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/actor/:id
async function getById(req, res) {
  const actor = await actorRepository.findById(req.params.id);
  if (!actor) return res.status(404).json({ message: 'Actor not found' });
  res.json(actor);
}

// POST /api/actor { full_name, avatar_url, bio, dob, nationality } (super admin)
async function create(req, res) {
  const { full_name, avatar_url, bio, dob, nationality } = req.body;
  if (!full_name) return res.status(400).json({ message: 'full_name is required' });

  const id = await nextId('actor');
  const actor = await actorRepository.create({
    id,
    full_name,
    avatar_url: avatar_url || '',
    bio: bio || '',
    dob: dob || null,
    nationality: nationality || '',
  });
  res.status(201).json(actor);
}

// PUT /api/actor/:id (super admin)
async function update(req, res) {
  const fields = ['full_name', 'avatar_url', 'bio', 'dob', 'nationality'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const actor = await actorRepository.updateFields(req.params.id, updates);
  if (!actor) return res.status(404).json({ message: 'Actor not found' });
  res.json(actor);
}

// DELETE /api/actor/:id (super admin)
async function remove(req, res) {
  await actorRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
