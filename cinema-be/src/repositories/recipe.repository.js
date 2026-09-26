const Recipe = require('../models/Recipe');
const nextId = require('../utils/nextId');

async function findById(id) {
  return Recipe.findOne({ id: Number(id) });
}

async function findByProductId(productId) {
  return Recipe.findOne({ product_id: Number(productId) });
}

// Recipes for a set of products in ONE branch. The branch filter is the isolation rule: a recipe
// that somehow points at a product of another branch is never applied to this branch's sale.
async function findByProductIds(productIds, branchId) {
  if (productIds.length === 0) return [];
  return Recipe.find({ product_id: { $in: productIds.map(Number) }, branch_id: Number(branchId) });
}

async function findBranchIdById(id) {
  const recipe = await Recipe.findOne({ id: Number(id) }, { branch_id: 1 });
  return recipe ? recipe.branch_id : null;
}

function buildListFilter({ branchId, branchIds, productId } = {}) {
  const filter = {};
  if (branchId !== undefined) filter.branch_id = Number(branchId);
  else if (branchIds) filter.branch_id = { $in: branchIds };
  if (productId !== undefined) filter.product_id = Number(productId);
  return filter;
}

async function list({ skip = 0, limit = 20, ...criteria } = {}) {
  const filter = buildListFilter(criteria);
  const [data, total] = await Promise.all([
    Recipe.find(filter).sort({ id: -1 }).skip(skip).limit(limit),
    Recipe.countDocuments(filter),
  ]);
  return { data, total };
}

async function create({ branchId, productId, ingredients, note = '', updatedBy = null }) {
  return Recipe.create({
    id: await nextId('recipe'),
    branch_id: branchId,
    product_id: productId,
    ingredients,
    note,
    updated_by: updatedBy,
  });
}

async function updateFields(id, updates) {
  return Recipe.findOneAndUpdate({ id: Number(id) }, { $set: updates }, { new: true });
}

async function remove(id) {
  return Recipe.deleteOne({ id: Number(id) });
}

async function removeByProductId(productId) {
  return Recipe.deleteMany({ product_id: Number(productId) });
}

// Is this Inventory record an ingredient of any recipe? Guards deleting it (a sale would then find
// its recipe pointing at nothing) and changing what its quantities mean (unit / tracked link).
async function existsForInventory(inventoryId) {
  return (await Recipe.exists({ 'ingredients.inventory_id': Number(inventoryId) })) !== null;
}

async function listForInventory(inventoryId) {
  return Recipe.find({ 'ingredients.inventory_id': Number(inventoryId) }).sort({ id: 1 });
}

module.exports = {
  findById,
  findByProductId,
  findByProductIds,
  findBranchIdById,
  list,
  create,
  updateFields,
  remove,
  removeByProductId,
  existsForInventory,
  listForInventory,
};
