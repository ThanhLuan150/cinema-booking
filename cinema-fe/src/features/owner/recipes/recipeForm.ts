import type { Inventory, Recipe } from '@/types/entities';
import type { CreateRecipePayload, RecipeIngredientPayload } from './api/recipes.api';

export const MAX_INGREDIENTS = 50;
const QUANTITY_FACTOR = 1e6;
const MAX_NOTE_LENGTH = 500;

// An ingredient row while it is being edited: everything is a string because it comes from inputs.
export interface IngredientDraft {
  key: number; // local identity for React; never sent
  inventory_id: string;
  quantity: string;
}

export interface RecipeForm {
  branch_id: string;
  product_id: string;
  note: string;
  lines: IngredientDraft[];
}

export type RecipeFormErrors = Partial<
  Record<'branch_id' | 'product_id' | 'lines' | 'note', string>
>;

let nextKey = 1;
export const newLine = (overrides: Partial<IngredientDraft> = {}): IngredientDraft => ({
  key: nextKey++,
  inventory_id: '',
  quantity: '',
  ...overrides,
});

export function emptyRecipeForm(defaultBranchId = ''): RecipeForm {
  return { branch_id: defaultBranchId, product_id: '', note: '', lines: [newLine()] };
}

export function recipeToForm(recipe: Recipe): RecipeForm {
  return {
    branch_id: String(recipe.branch_id),
    product_id: String(recipe.product_id),
    note: recipe.note ?? '',
    lines: recipe.ingredients.length
      ? recipe.ingredients.map((line) =>
          newLine({ inventory_id: String(line.inventory_id), quantity: String(line.quantity) }),
        )
      : [newLine()],
  };
}

const isBlank = (line: IngredientDraft) => !line.inventory_id && !line.quantity.trim();
const isPositive = (value: string) =>
  value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;

// Returns keys into the i18n `recipes.validation` block; empty when the form can be saved. The
// server re-checks all of it — this is only so the user sees a message before the round trip.
export function validateRecipeForm(form: RecipeForm, { editing = false } = {}): RecipeFormErrors {
  const errors: RecipeFormErrors = {};
  if (!editing) {
    if (!form.branch_id) errors.branch_id = 'branchRequired';
    if (!form.product_id) errors.product_id = 'productRequired';
  }
  if (form.note.trim().length > MAX_NOTE_LENGTH) errors.note = 'noteTooLong';

  const filled = form.lines.filter((line) => !isBlank(line));
  if (filled.length === 0) errors.lines = 'linesRequired';
  else if (filled.some((line) => !line.inventory_id || !isPositive(line.quantity)))
    errors.lines = 'lineInvalid';
  else if (new Set(filled.map((line) => line.inventory_id)).size !== filled.length)
    errors.lines = 'duplicateLine';
  else if (filled.length > MAX_INGREDIENTS) errors.lines = 'tooManyLines';
  return errors;
}

export function toIngredientPayload(form: RecipeForm): RecipeIngredientPayload[] {
  return form.lines
    .filter((line) => !isBlank(line))
    .map((line) => ({ inventory_id: Number(line.inventory_id), quantity: Number(line.quantity) }));
}

export function toCreatePayload(form: RecipeForm): CreateRecipePayload {
  return {
    product_id: Number(form.product_id),
    ingredients: toIngredientPayload(form),
    note: form.note.trim(),
  };
}

// --- Display-only preview -------------------------------------------------------------------
// Mirrors cinema-be/src/utils/recipeCalculation.js so the form can show what a recipe will cost
// and how many portions the stock supports before it is saved. The server recomputes every figure
// and never trusts these.

export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * QUANTITY_FACTOR) / QUANTITY_FACTOR;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface RecipePreview {
  cost: number;
  margin: number | null;
  marginPercent: number | null;
  // How many whole portions the stock on hand supports; null while there is nothing to compute.
  maxServings: number | null;
  limitingId: number | null;
}

export function previewRecipe(
  lines: IngredientDraft[],
  inventoryById: Map<number, Inventory>,
  price: number | null,
): RecipePreview {
  let cost = 0;
  let max = Infinity;
  let limitingId: number | null = null;
  let counted = 0;

  for (const line of lines) {
    const quantity = Number(line.quantity);
    const inventory = inventoryById.get(Number(line.inventory_id));
    if (!inventory || !Number.isFinite(quantity) || quantity <= 0) continue;
    counted += 1;
    cost += quantity * inventory.cost_price;
    // Snap before flooring: 0.3 / 0.1 is 2.9999999999999996 in doubles.
    const portions = Math.floor(roundQuantity(inventory.quantity / quantity));
    if (portions < max) {
      max = portions;
      limitingId = inventory.id;
    }
  }

  const roundedCost = roundMoney(cost);
  const margin = price === null || counted === 0 ? null : roundMoney(price - roundedCost);
  return {
    cost: roundedCost,
    margin,
    marginPercent: margin === null || !price ? null : roundMoney((margin / price) * 100),
    maxServings: counted === 0 ? null : max,
    limitingId,
  };
}
