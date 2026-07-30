const comboRepository = require('../repositories/combo.repository');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);

  if (req.query.cinemaId) {
    const { data, total } = await comboRepository.findActiveByCinemaId(req.query.cinemaId, { skip, limit });
    return res.json(buildPaginatedResult({ data, total, page, limit }));
  }

  if (req.account?.role === 2) {
    const cinemaIds = await comboRepository.findOwnedCinemaIds(req.account.accountId);
    const { data, total } = await comboRepository.findByCinemaIds(cinemaIds, { skip, limit });
    return res.json(buildPaginatedResult({ data, total, page, limit }));
  }

  if (req.account?.role === 0) {
    const { data, total } = await comboRepository.findAll({ skip, limit });
    return res.json(buildPaginatedResult({ data, total, page, limit }));
  }

  const { data, total } = await comboRepository.findActive({ skip, limit });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/combo/:id
async function getById(req, res) {
  const combo = await comboRepository.findById(req.params.id);
  if (!combo) return res.status(404).json({ message: 'Combo not found' });
  res.json(combo);
}

// POST /api/combo { cinema_id, name, description, price, image } (owner/admin)
async function create(req, res) {
  const { cinema_id, name, description, price, image } = req.body;
  if (!name || price === undefined) return res.status(400).json({ message: 'name and price are required' });

  const id = await nextId('combo');
  const combo = await comboRepository.create({
    id,
    cinema_id: Number(cinema_id),
    name,
    description: description || '',
    price: Number(price),
    image: image || '',
  });
  res.status(201).json(combo);
}

// PUT /api/combo/:id (owner/admin)
async function update(req, res) {
  const fields = ['name', 'description', 'price', 'image', 'active'];
  const updates = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  }
  const combo = await comboRepository.updateFields(req.params.id, updates);
  if (!combo) return res.status(404).json({ message: 'Combo not found' });
  res.json(combo);
}

// DELETE /api/combo/:id (owner/admin)
async function remove(req, res) {
  await comboRepository.remove(req.params.id);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, create, update, remove };
