const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth } = require('../middleware/auth');
const { requirePermission, requireBranchAccess } = require('../middleware/permission');
const recipeRepository = require('../repositories/recipe.repository');
const comboRepository = require('../repositories/combo.repository');
const recipeController = require('../controllers/recipe.controller');

const router = express.Router();

const recipeBranch = (req) => recipeRepository.findBranchIdById(req.params.id);
// A missing / non-numeric product_id resolves to no branch (404) rather than a cast error.
const productBranch = (req) => {
  const productId = Number(req.body.product_id);
  return Number.isInteger(productId) ? comboRepository.findCinemaIdByComboId(productId) : null;
};

// Reads — recipe.read: BRANCH for a Branch Admin (their own branches), ALL for Super Admin, and
// BRANCH for an Employee only if their Position was granted it (kitchen/prep staff).
// GET /api/recipes?branchId=&productId=&page=&limit=
router.get('/', requireAuth, requirePermission('recipe.read'), asyncHandler(recipeController.list));
// GET /api/recipes/:id/availability?servings=N -> can N portions be made from the stock on hand?
router.get(
  '/:id/availability',
  requireAuth,
  requirePermission('recipe.read'),
  asyncHandler(recipeController.availability),
);
router.get('/:id', requireAuth, requirePermission('recipe.read'), asyncHandler(recipeController.getById));

// Writes — recipe.manage AND access to the recipe's branch (owner, or an Employee actively staffed
// there whose Position was granted recipe.manage). An Employee without the permission gets 403
// before anything is read or changed; no default Position holds it.
// POST /api/recipes { product_id, ingredients: [{ inventory_id, quantity }], note? }
router.post(
  '/',
  requireAuth,
  requirePermission('recipe.manage'),
  requireBranchAccess(productBranch),
  asyncHandler(recipeController.create),
);
// PUT /api/recipes/:id { ingredients?, note? }
router.put(
  '/:id',
  requireAuth,
  requirePermission('recipe.manage'),
  requireBranchAccess(recipeBranch),
  asyncHandler(recipeController.update),
);
// DELETE /api/recipes/:id
router.delete(
  '/:id',
  requireAuth,
  requirePermission('recipe.manage'),
  requireBranchAccess(recipeBranch),
  asyncHandler(recipeController.remove),
);

module.exports = router;
