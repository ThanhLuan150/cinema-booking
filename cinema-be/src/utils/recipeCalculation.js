const QUANTITY_PRECISION = 6;
const MAX_INGREDIENTS = 50;
const MAX_INGREDIENT_QUANTITY = 1e9;

const FACTOR = 10 ** QUANTITY_PRECISION;

function roundQuantity(value) {
  return Math.round((value + Number.EPSILON) * FACTOR) / FACTOR;
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseIngredientLines(rawLines) {
  if (!Array.isArray(rawLines)) {
    return { error: { code: 'VALIDATION_ERROR', message: 'ingredients must be an array' } };
  }
  if (rawLines.length === 0) {
    return { error: { code: 'RECIPE_EMPTY', message: 'A recipe needs at least one ingredient' } };
  }
  if (rawLines.length > MAX_INGREDIENTS) {
    return { error: { code: 'TOO_MANY_INGREDIENTS', message: `A recipe may have at most ${MAX_INGREDIENTS} ingredients` } };
  }

  const seen = new Set();
  const lines = [];
  for (const raw of rawLines) {
    const inventoryId = Number(raw && raw.inventory_id);
    if (!raw || raw.inventory_id === '' || raw.inventory_id === null || !Number.isInteger(inventoryId)) {
      return { error: { code: 'VALIDATION_ERROR', message: 'every ingredient needs an integer inventory_id' } };
    }
    if (seen.has(inventoryId)) {
      return { error: { code: 'DUPLICATE_INGREDIENT', message: `Ingredient ${inventoryId} appears more than once` } };
    }
    seen.add(inventoryId);

    const rawQuantity = raw.quantity;
    const quantity = rawQuantity === '' || rawQuantity === null || rawQuantity === undefined ? NaN : Number(rawQuantity);
    const rounded = Number.isFinite(quantity) ? roundQuantity(quantity) : NaN;
    if (!(rounded > 0) || rounded > MAX_INGREDIENT_QUANTITY) {
      return { error: { code: 'VALIDATION_ERROR', message: 'ingredient quantity must be a positive number' } };
    }
    lines.push({ inventory_id: inventoryId, quantity: rounded });
  }
  return { lines };
}

// Ingredient demand of `servings` portions of one recipe: Map<inventory_id, quantity>.
function scaleRecipe(ingredients, servings = 1) {
  const demand = new Map();
  for (const { inventory_id: id, quantity } of ingredients) {
    demand.set(id, roundQuantity((demand.get(id) || 0) + quantity * servings));
  }
  return demand;
}

function aggregateDemand(entries) {
  const total = new Map();
  for (const { ingredients, servings, productId } of entries) {
    for (const [id, quantity] of scaleRecipe(ingredients, servings)) {
      const current = total.get(id) || { quantity: 0, productIds: [] };
      current.quantity = roundQuantity(current.quantity + quantity);
      if (productId !== undefined && !current.productIds.includes(productId)) current.productIds.push(productId);
      total.set(id, current);
    }
  }
  return total;
}

function maxServings(ingredients, stockById) {
  let max = Infinity;
  let limitingId = null;
  for (const { inventory_id: id, quantity } of ingredients) {
    const stock = stockById.get(id);
    const portions = stock === undefined ? 0 : Math.floor(roundQuantity(stock / quantity));
    if (portions < max) {
      max = portions;
      limitingId = id;
    }
  }
  return { max: Number.isFinite(max) ? max : 0, limitingId };
}

// The ingredients that cannot cover `servings` portions. `demand` is scaleRecipe/aggregateDemand
// output normalised to Map<id, quantity>; `stockById` is Map<id, quantity>.
// Returns [{ inventory_id, requested, available }] (empty = enough of everything).
function findShortfalls(demand, stockById) {
  const shortfalls = [];
  for (const [id, requested] of demand) {
    const available = stockById.get(id);
    if (available === undefined || available < requested) {
      shortfalls.push({ inventory_id: id, requested, available: available === undefined ? 0 : available });
    }
  }
  return shortfalls;
}

// Ingredient cost of ONE portion: sum(quantity x cost_price per stock unit). `costById` is
// Map<inventory_id, cost_price>; an unknown ingredient counts as free (cost 0) rather than
// failing — the caller flags missing stock records separately.
function recipeCost(ingredients, costById) {
  let total = 0;
  for (const { inventory_id: id, quantity } of ingredients) total += quantity * (costById.get(id) || 0);
  return roundMoney(total);
}

// Selling price vs ingredient cost. margin = price - cost; marginPercent is relative to the
// selling price (null when the price is 0, where a percentage is meaningless).
function marginOf(price, cost) {
  const margin = roundMoney(price - cost);
  return { margin, marginPercent: price > 0 ? roundMoney((margin / price) * 100) : null };
}

module.exports = {
  QUANTITY_PRECISION,
  MAX_INGREDIENTS,
  roundQuantity,
  roundMoney,
  parseIngredientLines,
  scaleRecipe,
  aggregateDemand,
  maxServings,
  findShortfalls,
  recipeCost,
  marginOf,
};
