const actorRepository = require('../repositories/actor.repository');
const nextId = require('../utils/nextId');
const { uploadImage } = require('../utils/uploadImage');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { emitPublic } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');

// Part of the public movie catalogue (credits / genre chips), so this goes out to everyone,
// including the anonymous visitors reading a movie page right now.
function broadcastActor(row, action) {
  if (!row) return;
  emitPublic(REALTIME_EVENT.CATALOGUE_UPDATED, { scope: 'ACTOR', action, id: row.id });
}

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

  const avatarFile = req.files?.avatar_url?.[0];
  const avatarUrl = avatarFile ? await uploadImage(avatarFile, 'actors') : avatar_url || '';

  const id = await nextId('actor');
  const actor = await actorRepository.create({
    id,
    full_name,
    avatar_url: avatarUrl,
    bio: bio || '',
    dob: dob || null,
    nationality: nationality || '',
  });
  broadcastActor(actor, REALTIME_ACTION.CREATED);
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
  broadcastActor(actor, REALTIME_ACTION.UPDATED);
  res.json(actor);
}

// DELETE /api/actor/:id (super admin)
async function remove(req, res) {
  const existing = await actorRepository.findById(req.params.id);
  await actorRepository.remove(req.params.id);
  broadcastActor(existing, REALTIME_ACTION.DELETED);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
