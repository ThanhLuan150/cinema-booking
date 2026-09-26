const recipeRepository = require('../repositories/recipe.repository');
const inventoryRepository = require('../repositories/inventory.repository');
const comboRepository = require('../repositories/combo.repository');
const Combo = require('../models/Combo');
const Inventory = require('../models/Inventory');
const { recordAudit, ACTION, ENTITY_TYPE } = require('../services/auditLog.service');
const { parsePagination, buildPaginatedResult } = require('../utils/pagination');
const { emitBranchEvent } = require('../utils/socket');
const { REALTIME_EVENT, REALTIME_ACTION } = require('../utils/realtimeEvents');
const calc = require('../utils/recipeCalculation');

const MAX_NOTE_LENGTH = 500;
const MAX_SERVINGS = 100000;

function fail(res, status, code, message, extra = {}) {
  return res.status(status).json({ message, code, ...extra });
}

// Stock is per branch, so a recipe change is announced to that branch's room (and Super Admin's).
function broadcastRecipe(recipe, action) {
  emitBranchEvent(recipe.branch_id, REALTIME_EVENT.RECIPE_UPDATED, {
    action,
    id: recipe.id,
    productId: recipe.product_id,
  });
}

async function auditRecipe(req, recipe, action) {
  await recordAudit({
    req,
    action,
    entityType: ENTITY_TYPE.RECIPE,
    entityId: recipe.id,
    branchId: recipe.branch_id,
    metadata: { productId: recipe.product_id, ingredientCount: recipe.ingredients.length },
  });
}

// READ access: ALL scope anywhere; BRANCH scope only the branches the caller owns (Branch Admin) or
// is actively staffed at (an Employee whose Position grants recipe.read).
async function resolveReadScope(req) {
  const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
  if (req.permissionScope === 'ALL') return { branchId };
  const readable = await inventoryRepository.findReadableBranchIds(req.account.accountId);
  if (branchId !== undefined && !readable.includes(branchId)) return { forbidden: true };
  return { branchId, branchIds: branchId === undefined ? readable : undefined };
}

async function canReadRecipe(req, recipe) {
  if (req.permissionScope === 'ALL') return true;
  const readable = await inventoryRepository.findReadableBranchIds(req.account.accountId);
  return readable.includes(recipe.branch_id);
}

// Decorates recipes with the product, each ingredient's live stock, and the calculated figures
// (cost per portion, margin, how many portions the current stock can make). One bulk lookup per
// collection, however many recipes are shown.
async function present(recipes) {
  const list = Array.isArray(recipes) ? recipes : [recipes];
  const products = await comboRepository.findByIds([...new Set(list.map((r) => r.product_id))]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const ingredientIds = [...new Set(list.flatMap((r) => r.ingredients.map((i) => i.inventory_id)))];
  const inventories = ingredientIds.length > 0 ? await inventoryRepository.findByIds(ingredientIds) : [];
  const inventoryById = new Map(inventories.map((i) => [i.id, i]));

  const shaped = list.map((recipe) => {
    // An ingredient of another branch (or a deleted record) counts as missing: never readable, never usable.
    const usable = (id) => {
      const inventory = inventoryById.get(id);
      return inventory && inventory.branch_id === recipe.branch_id ? inventory : null;
    };
    const stockById = new Map();
    const costById = new Map();
    for (const { inventory_id: id } of recipe.ingredients) {
      const inventory = usable(id);
      if (!inventory) continue;
      stockById.set(id, inventory.quantity);
      costById.set(id, inventory.cost_price);
    }

    const product = productById.get(recipe.product_id);
    const cost = calc.recipeCost(recipe.ingredients, costById);
    const { max, limitingId } = calc.maxServings(recipe.ingredients, stockById);
    const ingredients = recipe.ingredients.map(({ inventory_id: id, quantity }) => {
      const inventory = usable(id);
      return {
        inventory_id: id,
        quantity,
        missing: !inventory,
        item: inventory ? inventory.item : null,
        sku: inventory ? inventory.sku : null,
        unit: inventory ? inventory.unit : null,
        cost_price: inventory ? inventory.cost_price : 0,
        line_cost: calc.roundMoney(quantity * (inventory ? inventory.cost_price : 0)),
        stock_quantity: inventory ? inventory.quantity : 0,
        minimum_quantity: inventory ? inventory.minimum_quantity : 0,
        status: inventory ? inventory.status : Inventory.STATUS.OUT_OF_STOCK,
      };
    });

    return {
      ...recipe.toJSON(),
      ingredients,
      product: product
        ? { id: product.id, name: product.name, type: product.type, price: product.price, active: product.active }
        : null,
      cost_per_portion: cost,
      ...(() => {
        if (!product) return { margin: null, margin_percent: null };
        const { margin, marginPercent } = calc.marginOf(product.price, cost);
        return { margin, margin_percent: marginPercent };
      })(),
      max_servings: max,
      limiting_ingredient_id: limitingId,
      can_make: max > 0,
    };
  });
  return Array.isArray(recipes) ? shaped : shaped[0];
}

// Checks every line points at an ingredient that exists, in THIS branch, and is raw stock rather than
// a directly-tracked product. Returns { error: { status, code, message } } or { ok: true }.
async function validateIngredients(branchId, lines) {
  const inventories = await inventoryRepository.findByIds(lines.map((l) => l.inventory_id));
  const byId = new Map(inventories.map((i) => [i.id, i]));
  for (const { inventory_id: id } of lines) {
    const inventory = byId.get(id);
    if (!inventory) {
      return { error: { status: 400, code: 'INGREDIENT_NOT_FOUND', message: `Ingredient ${id} not found` } };
    }
    if (inventory.branch_id !== branchId) {
      return {
        error: { status: 400, code: 'INGREDIENT_BRANCH_MISMATCH', message: `Ingredient ${id} does not belong to this branch` },
      };
    }
    // A record linked to a sellable item is that item's own stock count, not a raw ingredient.
    if (inventory.combo_id !== null && inventory.combo_id !== undefined) {
      return {
        error: {
          status: 400,
          code: 'INGREDIENT_NOT_ALLOWED',
          message: `${inventory.item} is a tracked product, not an ingredient`,
        },
      };
    }
  }
  return { ok: true };
}

function parseNote(body) {
  if (body.note === undefined || body.note === null) return { note: '' };
  const note = String(body.note).trim();
  if (note.length > MAX_NOTE_LENGTH) return { error: `note must be at most ${MAX_NOTE_LENGTH} characters` };
  return { note };
}

// GET /api/recipes?branchId=&productId=&page=&limit=
async function list(req, res) {
  const { page, limit, skip } = parsePagination(req.query);
  const scope = await resolveReadScope(req);
  if (scope.forbidden) return res.status(403).json({ message: 'Forbidden' });

  let productId;
  if (req.query.productId !== undefined && req.query.productId !== '') {
    productId = Number(req.query.productId);
    if (!Number.isInteger(productId)) return fail(res, 400, 'VALIDATION_ERROR', 'productId must be an integer');
  }
  const { data, total } = await recipeRepository.list({
    branchId: scope.branchId,
    branchIds: scope.branchIds,
    productId,
    skip,
    limit,
  });
  res.json(buildPaginatedResult({ data: await present(data), total, page, limit }));
}

// GET /api/recipes/:id
async function getById(req, res) {
  const recipe = await recipeRepository.findById(req.params.id);
  if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
  if (!(await canReadRecipe(req, recipe))) return res.status(403).json({ message: 'Forbidden' });
  res.json(await present(recipe));
}

// GET /api/recipes/:id/availability?servings=N -> can N portions be made from the stock on hand?
// Read-only preview of exactly the check a sale of N portions goes through.
async function availability(req, res) {
  const recipe = await recipeRepository.findById(req.params.id);
  if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
  if (!(await canReadRecipe(req, recipe))) return res.status(403).json({ message: 'Forbidden' });

  const servings = req.query.servings === undefined ? 1 : Number(req.query.servings);
  if (!Number.isInteger(servings) || servings < 1 || servings > MAX_SERVINGS) {
    return fail(res, 400, 'VALIDATION_ERROR', `servings must be an integer between 1 and ${MAX_SERVINGS}`);
  }

  const inventories = await inventoryRepository.findByIds(recipe.ingredients.map((i) => i.inventory_id));
  const byId = new Map(inventories.filter((i) => i.branch_id === recipe.branch_id).map((i) => [i.id, i]));
  const stockById = new Map([...byId].map(([id, inventory]) => [id, inventory.quantity]));

  const demand = calc.scaleRecipe(recipe.ingredients, servings);
  const shortfalls = calc.findShortfalls(demand, stockById);
  const { max, limitingId } = calc.maxServings(recipe.ingredients, stockById);
  const describe = (entry) => {
    const inventory = byId.get(entry.inventory_id);
    return { ...entry, item: inventory ? inventory.item : null, unit: inventory ? inventory.unit : null };
  };
  res.json({
    recipe_id: recipe.id,
    product_id: recipe.product_id,
    servings,
    can_make: shortfalls.length === 0,
    max_servings: max,
    limiting_ingredient_id: limitingId,
    requirements: [...demand].map(([id, requested]) =>
      describe({ inventory_id: id, requested, available: stockById.get(id) ?? 0 }),
    ),
    shortages: shortfalls.map(describe),
  });
}

// POST /api/recipes { product_id, ingredients: [{ inventory_id, quantity }], note? }
// (recipe.manage, and the caller must own / be staffed at the product's branch)
async function create(req, res) {
  const parsed = calc.parseIngredientLines(req.body.ingredients);
  if (parsed.error) return fail(res, 400, parsed.error.code, parsed.error.message);
  const noteResult = parseNote(req.body);
  if (noteResult.error) return fail(res, 400, 'VALIDATION_ERROR', noteResult.error);

  const product = await comboRepository.findById(req.body.product_id);
  if (!product) return fail(res, 404, 'PRODUCT_NOT_FOUND', 'Product not found');
  if (product.type === Combo.TYPE.COMBO) {
    return fail(
      res,
      400,
      'PRODUCT_NOT_RECIPE_ELIGIBLE',
      'Only a FOOD or BEVERAGE item has a recipe; a COMBO bundle is made of the items it contains',
    );
  }
  // A recipe replaces direct stock tracking of the product — keeping both would deduct it twice.
  const tracked = await inventoryRepository.findTrackedForProduct(product.cinema_id, product.id);
  if (tracked) {
    return fail(res, 409, 'PRODUCT_ALREADY_TRACKED', 'This product already has its own stock record; remove that link first');
  }
  const checked = await validateIngredients(product.cinema_id, parsed.lines);
  if (checked.error) return fail(res, checked.error.status, checked.error.code, checked.error.message);

  let recipe;
  try {
    recipe = await recipeRepository.create({
      branchId: product.cinema_id,
      productId: product.id,
      ingredients: parsed.lines,
      note: noteResult.note,
      updatedBy: req.account.accountId,
    });
  } catch (err) {
    if (err?.code === 11000) return fail(res, 409, 'RECIPE_ALREADY_EXISTS', 'This product already has a recipe');
    throw err;
  }
  broadcastRecipe(recipe, REALTIME_ACTION.CREATED);
  await auditRecipe(req, recipe, ACTION.RECIPE_CREATED);
  res.status(201).json(await present(recipe));
}

// PUT /api/recipes/:id { ingredients?, note? } — `ingredients`, when sent, REPLACES the whole list.
async function update(req, res) {
  const existing = await recipeRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Recipe not found' });

  const updates = { updated_by: req.account.accountId };
  if (req.body.ingredients !== undefined) {
    const parsed = calc.parseIngredientLines(req.body.ingredients);
    if (parsed.error) return fail(res, 400, parsed.error.code, parsed.error.message);
    const checked = await validateIngredients(existing.branch_id, parsed.lines);
    if (checked.error) return fail(res, checked.error.status, checked.error.code, checked.error.message);
    updates.ingredients = parsed.lines;
  }
  if (req.body.note !== undefined) {
    const noteResult = parseNote(req.body);
    if (noteResult.error) return fail(res, 400, 'VALIDATION_ERROR', noteResult.error);
    updates.note = noteResult.note;
  }

  const recipe = await recipeRepository.updateFields(existing.id, updates);
  if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
  broadcastRecipe(recipe, REALTIME_ACTION.UPDATED);
  await auditRecipe(req, recipe, ACTION.RECIPE_UPDATED);
  res.json(await present(recipe));
}

// DELETE /api/recipes/:id — the product goes back to being untracked (not stock-limited).
async function remove(req, res) {
  const existing = await recipeRepository.findById(req.params.id);
  if (!existing) return res.status(404).json({ message: 'Recipe not found' });
  await recipeRepository.remove(existing.id);
  broadcastRecipe(existing, REALTIME_ACTION.DELETED);
  await auditRecipe(req, existing, ACTION.RECIPE_DELETED);
  res.json({ message: 'Deleted' });
}

module.exports = { list, getById, availability, create, update, remove };
