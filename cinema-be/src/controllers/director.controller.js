const directorRepository = require('../repositories/director.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

// GET /api/director?page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await directorRepository.findAll({ skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/director/:id
async function getById(req, res) {
  const director = await directorRepository.findById(req.params.id);
  if (!director) return res.status(404).json({ message: 'Director not found' });
  res.json(director);
}

// POST /api/director { full_name, avatar_url, bio, dob, nationality } (super admin)
async function create(req, res) {
  const { full_name, avatar_url, bio, dob, nationality } = req.body;
  if (!full_name) return res.status(400).json({ message: 'full_name is required' });

  const id = await nextId('director');
  const director = await directorRepository.create({
    id,
    full_name,
    avatar_url: avatar_url || '',
    bio: bio || '',
    dob: dob || null,
    nationality: nationality || '',
  });
  res.status(201).json(director);
}

// PUT /api/director/:id (super admin)
async function update(req, res) {
  const fields = ['full_name', 'avatar_url', 'bio', 'dob', 'nationality'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const director = await directorRepository.updateFields(req.params.id, updates);
  if (!director) return res.status(404).json({ message: 'Director not found' });
  res.json(director);
}

// DELETE /api/director/:id (super admin)
async function remove(req, res) {
  await directorRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
