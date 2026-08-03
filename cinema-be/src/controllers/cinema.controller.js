const cinemaRepository = require('../repositories/cinema.repository');
const nextId = require('../utils/nextId');
const { emitToAdmin, emitToOwner } = require('../utils/socket');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { uploadImage } = require('../utils/uploadImage');

// GET /api/cinema?page=&limit= -> public list of approved cinemas (for the customer-facing "choose cinema" filter)
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await cinemaRepository.findApproved({ skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/cinema/mine?page=&limit= -> cinemas owned by the caller, any status (auth: admin or theater staff)
async function mine(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const { data, total } = await cinemaRepository.findMine({
    role: req.account.role,
    accountId: req.account.accountId,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/cinema/pending -> admin only, cinemas awaiting approval
async function pending(req, res) {
  const cinemas = await cinemaRepository.findPending();
  res.json(cinemas);
}

// GET /api/cinema/top -> approved cinemas ranked by ticket booking volume, enriched with the
// average customer rating across the movies they've screened (public, for the homepage).
async function top(req, res) {
  const result = await cinemaRepository.getTopRanked();
  res.json(result);
}

// GET /api/cinema/favorites/mine -> cinemas the caller has favorited (auth required)
async function favoritesMine(req, res) {
  const result = await cinemaRepository.findFavoriteCinemasByAccountId(req.account.accountId);
  res.json(result);
}

// GET /api/cinema/:id/favorite -> favorite count for that cinema (public)
async function favoriteCount(req, res) {
  const count = await cinemaRepository.countFavorites(req.params.id);
  res.json(count);
}

// POST /api/cinema/favorite { cinema_id } (auth required)
async function favorite(req, res) {
  const { cinema_id } = req.body;
  if (cinema_id === undefined) return res.status(400).json({ message: 'cinema_id is required' });

  const existing = await cinemaRepository.findFavorite({ cinemaId: cinema_id, accountId: req.account.accountId });
  if (existing) return res.status(200).json(existing);

  const id = await nextId('favoriteCinema');
  const favoriteDoc = await cinemaRepository.createFavorite({
    id,
    cinemaId: cinema_id,
    accountId: req.account.accountId,
  });
  res.status(201).json(favoriteDoc);
}

// POST /api/cinema/unfavorite { cinema_id } (auth required)
async function unfavorite(req, res) {
  const { cinema_id } = req.body;
  if (cinema_id === undefined) return res.status(400).json({ message: 'cinema_id is required' });

  await cinemaRepository.deleteFavorite({ cinemaId: cinema_id, accountId: req.account.accountId });
  res.json({ message: 'Unfavorited' });
}

// GET /api/cinema/:id -> public detail
async function getById(req, res) {
  const cinema = await cinemaRepository.findById(req.params.id);
  if (!cinema) return res.status(404).json({ message: 'Cinema not found' });
  res.json(cinema);
}

// POST /api/cinema/onboard (multipart: email, name, address, city, phone, avatar file, images
async function onboard(req, res) {
  const { email, name, address, city, phone } = req.body;
  if (!email || !name || !phone) {
    return res.status(400).json({ message: 'email, name and phone are required' });
  }

  const account = await cinemaRepository.findAccountByEmail(email);
  if (!account) return res.status(404).json({ message: 'Account not found' });
  if (account.role !== 2) return res.status(400).json({ message: 'Account is not a theater owner' });

  const avatarFile = req.files?.avatar?.[0];
  const imageFiles = req.files?.images || [];
  const [avatarUrl, imageUrls] = await Promise.all([
    avatarFile ? uploadImage(avatarFile, 'cinemas/owners') : Promise.resolve(undefined),
    Promise.all(imageFiles.map((file) => uploadImage(file, 'cinemas'))),
  ]);

  const cinema = await cinemaRepository.upsertOnboard(account, {
    name,
    address,
    city,
    images: imageUrls.length ? imageUrls : undefined,
  });
  await cinemaRepository.updateOwnerContactInfo(account, { name, phone, avatar: avatarUrl });

  emitToAdmin('cinema:pending', cinema);
  res.status(201).json(cinema);
}

// POST /api/cinema (admin or theater staff)
async function create(req, res) {
  const { name, address, city, images } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });

  const id = await nextId('cinema');
  const ownerId = req.account.role === 0 && req.body.owner_id ? Number(req.body.owner_id) : req.account.accountId;

  const cinema = await cinemaRepository.create({
    id,
    owner_id: ownerId,
    name,
    address: address || '',
    city: city || '',
    images: Array.isArray(images) ? images : [],
    status: req.account.role === 0 ? 1 : 0, // admin-created cinemas are auto-approved
  });
  if (cinema.status === 0) emitToAdmin('cinema:pending', cinema);
  res.status(201).json(cinema);
}

// PUT /api/cinema/:id (owner or admin)
async function update(req, res) {
  const fields = ['name', 'address', 'city', 'images'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const cinema = await cinemaRepository.updateFields(req.params.id, updates);
  res.json(cinema);
}

// PUT /api/cinema/:id/approve (admin only) — also unlocks the owner account's login gate
async function approve(req, res) {
  const cinema = await cinemaRepository.approve(req.params.id);
  if (!cinema) return res.status(404).json({ message: 'Cinema not found' });

  await cinemaRepository.setAccountApproved(cinema.owner_id);

  emitToOwner(cinema.owner_id, 'cinema:approved', cinema);
  res.json(cinema);
}

// PUT /api/cinema/:id/block (admin only)
async function block(req, res) {
  const cinema = await cinemaRepository.block(req.params.id);
  if (!cinema) return res.status(404).json({ message: 'Cinema not found' });
  emitToOwner(cinema.owner_id, 'cinema:blocked', cinema);
  res.json(cinema);
}

// DELETE /api/cinema/:id (admin only)
async function remove(req, res) {
  await cinemaRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = {
  list,
  mine,
  pending,
  top,
  favoritesMine,
  favoriteCount,
  favorite,
  unfavorite,
  getById,
  onboard,
  create,
  update,
  approve,
  block,
  remove,
};
