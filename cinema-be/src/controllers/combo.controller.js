const comboRepository = require('../repositories/combo.repository');
const Combo = require('../models/Combo');
const nextId = require('../utils/nextId');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');

const VALID_TYPES = Object.values(Combo.TYPE);

async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const type = VALID_TYPES.includes(req.query.type) ? req.query.type : undefined;

  if (req.query.branchId) {
    const { data, total } = await comboRepository.findActiveByCinemaId(req.query.branchId, { skip, limit, type });
    return res.json(buildPaginatedResult({ data, total, page, limit }));
  }

  if (req.account?.role === 2) {
    const branchIds = await comboRepository.findOwnedCinemaIds(req.account.accountId);
    const { data, total } = await comboRepository.findByCinemaIds(branchIds, { skip, limit, type });
    return res.json(buildPaginatedResult({ data, total, page, limit }));
  }

  if (req.account?.role === 0) {
    const { data, total } = await comboRepository.findAll({ skip, limit, type });
    return res.json(buildPaginatedResult({ data, total, page, limit }));
  }

  const { data, total } = await comboRepository.findActive({ skip, limit, type });
  res.json(buildPaginatedResult({ data, total, page, limit }));
}

// GET /api/combo/:id
async function getById(req, res) {
  const combo = await comboRepository.findById(req.params.id);
  if (!combo) return res.status(404).json({ message: 'Combo not found' });
  res.json(combo);
}

// POST /api/combo { cinema_id, name, description, price, image, type, items } (owner/admin)
// `type` defaults to COMBO. When type is COMBO, `items` may list the FOOD/BEVERAGE items it
// bundles as [{ item_id, quantity }] — each item_id must already exist and not itself be a COMBO.
async function create(req, res) {
  const { cinema_id, name, description, price, image, type, items } = req.body;
  if (!name || price === undefined) return res.status(400).json({ message: 'name and price are required' });

  const comboType = type || Combo.TYPE.COMBO;
  if (!VALID_TYPES.includes(comboType)) {
    return res.status(400).json({ message: `type must be one of ${VALID_TYPES.join(', ')}` });
  }

  const normalizedItems = [];
  if (comboType === Combo.TYPE.COMBO && Array.isArray(items) && items.length > 0) {
    const componentIds = items.map((entry) => Number(entry.item_id));
    const components = await comboRepository.findByIds(componentIds);
    const componentById = new Map(components.map((c) => [c.id, c]));
    for (const entry of items) {
      const component = componentById.get(Number(entry.item_id));
      if (!component) return res.status(400).json({ message: `Item ${entry.item_id} not found` });
      if (component.type === Combo.TYPE.COMBO) {
        return res.status(400).json({ message: `Item ${entry.item_id} is a combo and cannot be nested inside another combo` });
      }
      normalizedItems.push({ item_id: component.id, quantity: Number(entry.quantity) || 1 });
    }
  }

  const id = await nextId('combo');
  const combo = await comboRepository.create({
    id,
    cinema_id: Number(cinema_id),
    name,
    description: description || '',
    price: Number(price),
    image: image || '',
    type: comboType,
    items: normalizedItems,
  });
  res.status(201).json(combo);
}

// PUT /api/combo/:id (owner/admin)
async function update(req, res) {
  const fields = ['name', 'description', 'price', 'image', 'active', 'type', 'items'];
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
