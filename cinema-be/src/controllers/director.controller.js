const directorRepository = require('../repositories/director.repository');
const nextId = require('../utils/nextId');
const { uploadImage } = require('../utils/uploadImage');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { emitPublic } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');

// Part of the public movie catalogue (credits), so this goes out to everyone, including the
// anonymous visitors reading a movie page right now.
function broadcastDirector(row, action) {
  if (!row) return;
  emitPublic(REALTIME_EVENT.CATALOGUE_UPDATED, { scope: 'DIRECTOR', action, id: row.id });
}

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

  const avatarFile = req.files?.avatar_url?.[0];
  const avatarUrl = avatarFile ? await uploadImage(avatarFile, 'directors') : avatar_url || '';

  const id = await nextId('director');
  const director = await directorRepository.create({
    id,
    full_name,
    avatar_url: avatarUrl,
    bio: bio || '',
    dob: dob || null,
    nationality: nationality || '',
  });
  broadcastDirector(director, REALTIME_ACTION.CREATED);
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
  broadcastDirector(director, REALTIME_ACTION.UPDATED);
  res.json(director);
}

// DELETE /api/director/:id (super admin)
async function remove(req, res) {
  const existing = await directorRepository.findById(req.params.id);
  await directorRepository.remove(req.params.id);
  broadcastDirector(existing, REALTIME_ACTION.DELETED);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
