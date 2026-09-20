const categoryRepository = require('../repositories/category.repository');
const nextId = require('../utils/nextId');
const { emitPublic } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');

async function list(req, res) {
  const cats = await categoryRepository.findAll();
  res.json(cats);
}

async function getById(req, res) {
  const cat = await categoryRepository.findById(req.params.id);
  if (!cat) return res.status(404).json({ message: 'Category not found' });
  res.json(cat);
}

async function create(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'name is required' });

  const id = await nextId('category');
  const cat = await categoryRepository.create({ id, name });
  // Genres drive the public movie filters, so a new one has to appear without a refresh.
  emitPublic(REALTIME_EVENT.CATALOGUE_UPDATED, { scope: 'CATEGORY', action: REALTIME_ACTION.CREATED, id: cat.id });
  res.status(201).json(cat);
}

module.exports = { list, getById, create };
