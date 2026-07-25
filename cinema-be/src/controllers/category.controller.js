const categoryRepository = require('../repositories/category.repository');
const nextId = require('../utils/nextId');

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
  res.status(201).json(cat);
}

module.exports = { list, getById, create };
