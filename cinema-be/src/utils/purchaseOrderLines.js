// Validation + arithmetic for the product lines of a Purchase Order. Pure (no I/O): the controller
// loads the Inventory records the lines point at and hands them in, which keeps every rule here
// unit-testable and keeps the "total is computed on the server" guarantee in one place.

const MAX_LINES = 200;
const MAX_QUANTITY = 1e9;
const MAX_UNIT_COST = 1e12;
const MAX_TOTAL = 1e13;

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

// A finite number within [min, max]; '', null, NaN, Infinity, strings that are not numbers → null.
function parseAmount(value, { min, max }) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

// Extracts the raw line list from a request body and checks its shape (not its stock records).
// Returns { error: { code, message } } or { lines: [{ inventory_id, quantity, unit_cost|undefined }] }.
function parseLines(rawItems) {
  if (!Array.isArray(rawItems)) return { error: { code: 'VALIDATION_ERROR', message: 'items must be an array' } };
  if (rawItems.length > MAX_LINES) {
    return { error: { code: 'TOO_MANY_LINES', message: `An order may have at most ${MAX_LINES} lines` } };
  }

  const seen = new Set();
  const lines = [];
  for (const raw of rawItems) {
    const inventoryId = Number(raw && raw.inventory_id);
    if (!raw || !Number.isInteger(inventoryId)) {
      return { error: { code: 'VALIDATION_ERROR', message: 'every line needs an integer inventory_id' } };
    }
    if (seen.has(inventoryId)) {
      return { error: { code: 'DUPLICATE_LINE', message: `Product ${inventoryId} appears on more than one line` } };
    }
    seen.add(inventoryId);

    // Strictly positive: a zero-quantity line is meaningless, and a negative one would let a
    // "receipt" REMOVE stock.
    const quantity = parseAmount(raw.quantity, { min: 0, max: MAX_QUANTITY });
    if (quantity === null || quantity === 0) {
      return { error: { code: 'VALIDATION_ERROR', message: 'quantity must be a positive number' } };
    }

    let unitCost;
    if (raw.unit_cost !== undefined && raw.unit_cost !== null && raw.unit_cost !== '') {
      unitCost = parseAmount(raw.unit_cost, { min: 0, max: MAX_UNIT_COST });
      if (unitCost === null) return { error: { code: 'VALIDATION_ERROR', message: 'unit_cost must be a non-negative number' } };
    }
    lines.push({ inventory_id: inventoryId, quantity, unit_cost: unitCost });
  }
  return { lines };
}

// Resolves parsed lines against the branch's Inventory records (a Map by id) into the persisted
// shape, snapshotting name/sku/unit and defaulting a missing unit_cost to the product's cost_price.
// Every product must exist AND belong to `branchId`: stock is per branch, so a line may never point
// at another branch's shelf.
function buildOrderItems(lines, inventoryById, branchId) {
  const items = [];
  let total = 0;
  for (const line of lines) {
    const inventory = inventoryById.get(line.inventory_id);
    if (!inventory) {
      return { error: { code: 'INVENTORY_NOT_FOUND', message: `Product ${line.inventory_id} not found`, status: 400 } };
    }
    if (inventory.branch_id !== branchId) {
      return {
        error: {
          code: 'INVENTORY_BRANCH_MISMATCH',
          message: `Product ${line.inventory_id} does not belong to this branch`,
          status: 400,
        },
      };
    }
    const unitCost = line.unit_cost !== undefined ? line.unit_cost : inventory.cost_price || 0;
    const lineTotal = roundMoney(line.quantity * unitCost);
    total += lineTotal;
    items.push({
      inventory_id: inventory.id,
      item: inventory.item,
      sku: inventory.sku || null,
      unit: inventory.unit,
      quantity: line.quantity,
      unit_cost: unitCost,
      line_total: lineTotal,
    });
  }
  total = roundMoney(total);
  if (total > MAX_TOTAL) {
    return { error: { code: 'TOTAL_TOO_LARGE', message: 'The order total is too large', status: 400 } };
  }
  return { items, total };
}

module.exports = { parseLines, buildOrderItems, roundMoney, MAX_LINES, MAX_QUANTITY, MAX_UNIT_COST, MAX_TOTAL };
