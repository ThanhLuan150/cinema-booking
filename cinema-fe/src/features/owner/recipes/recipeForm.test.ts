import { describe, expect, it } from 'vitest';
import type { Inventory, Recipe } from '@/types/entities';
import {
  emptyRecipeForm,
  newLine,
  previewRecipe,
  recipeToForm,
  roundMoney,
  roundQuantity,
  toCreatePayload,
  toIngredientPayload,
  validateRecipeForm,
  type RecipeForm,
} from './recipeForm';

const stock = (overrides: Partial<Inventory>): Inventory => ({
  id: 1,
  branch_id: 1,
  combo_id: null,
  item: 'Corn',
  sku: null,
  category: '',
  quantity: 1000,
  minimum_quantity: 0,
  unit: 'g',
  cost_price: 0,
  selling_price: 0,
  status: 'IN_STOCK',
  ...overrides,
});

// Large Popcorn: Corn 150g, Butter 20g, Salt 5g — the ticket's own example.
const CORN = stock({ id: 1, item: 'Corn', quantity: 1000, cost_price: 0.05 });
const BUTTER = stock({ id: 2, item: 'Butter', quantity: 100, cost_price: 0.4 });
const SALT = stock({ id: 3, item: 'Salt', quantity: 1000, cost_price: 0.01 });
const BY_ID = new Map([CORN, BUTTER, SALT].map((item) => [item.id, item]));

const formWith = (lines: [string, string][], overrides: Partial<RecipeForm> = {}): RecipeForm => ({
  branch_id: '1',
  product_id: '10',
  note: '',
  lines: lines.map(([inventory_id, quantity]) => newLine({ inventory_id, quantity })),
  ...overrides,
});

describe('validateRecipeForm', () => {
  it('accepts a complete new recipe', () => {
    expect(
      validateRecipeForm(
        formWith([
          ['1', '150'],
          ['2', '20'],
        ]),
      ),
    ).toEqual({});
  });

  it('needs a branch and a product when creating, but not when editing', () => {
    const form = formWith([['1', '150']], { branch_id: '', product_id: '' });
    expect(validateRecipeForm(form)).toEqual({
      branch_id: 'branchRequired',
      product_id: 'productRequired',
    });
    expect(validateRecipeForm(form, { editing: true })).toEqual({});
  });

  it('needs at least one ingredient (an untouched blank row does not count)', () => {
    expect(validateRecipeForm(emptyRecipeForm('1')).lines).toBe('linesRequired');
  });

  it.each([['0'], ['-5'], ['abc'], ['']])('rejects quantity %p', (quantity) => {
    expect(validateRecipeForm(formWith([['1', quantity]])).lines).toBe('lineInvalid');
  });

  it('rejects a quantity with no ingredient chosen', () => {
    expect(validateRecipeForm(formWith([['', '5']])).lines).toBe('lineInvalid');
  });

  it('rejects the same ingredient twice', () => {
    expect(
      validateRecipeForm(
        formWith([
          ['1', '5'],
          ['1', '6'],
        ]),
      ).lines,
    ).toBe('duplicateLine');
  });

  it('rejects more than 50 ingredients', () => {
    const many = Array.from({ length: 51 }, (_, i) => [String(i + 1), '1'] as [string, string]);
    expect(validateRecipeForm(formWith(many)).lines).toBe('tooManyLines');
  });

  it('rejects a note over 500 characters', () => {
    expect(validateRecipeForm(formWith([['1', '5']], { note: 'x'.repeat(501) })).note).toBe(
      'noteTooLong',
    );
  });

  it('ignores blank rows next to filled ones', () => {
    const form = formWith([['1', '5']]);
    form.lines.push(newLine());
    expect(validateRecipeForm(form)).toEqual({});
  });
});

describe('payload builders', () => {
  it('sends numbers, drops blank rows and trims the note', () => {
    const form = formWith(
      [
        ['1', '150'],
        ['2', '0.5'],
      ],
      { note: '  Pop first  ' },
    );
    form.lines.push(newLine());
    expect(toCreatePayload(form)).toEqual({
      product_id: 10,
      ingredients: [
        { inventory_id: 1, quantity: 150 },
        { inventory_id: 2, quantity: 0.5 },
      ],
      note: 'Pop first',
    });
    expect(toIngredientPayload(form)).toHaveLength(2);
  });

  it('recipeToForm loads a saved recipe back into editable strings', () => {
    const recipe = {
      branch_id: 1,
      product_id: 10,
      note: 'n',
      ingredients: [{ inventory_id: 1, quantity: 150 }],
    } as unknown as Recipe;
    const form = recipeToForm(recipe);
    expect(form).toMatchObject({ branch_id: '1', product_id: '10', note: 'n' });
    expect(form.lines.map(({ inventory_id, quantity }) => ({ inventory_id, quantity }))).toEqual([
      { inventory_id: '1', quantity: '150' },
    ]);
  });
});

describe('rounding', () => {
  it('removes binary drift from quantities and money', () => {
    expect(roundQuantity(0.1 * 3)).toBe(0.3);
    expect(roundMoney(1.005)).toBe(1.01);
  });
});

describe('previewRecipe (mirrors the server calculation)', () => {
  const popcorn = formWith([
    ['1', '150'],
    ['2', '20'],
    ['3', '5'],
  ]).lines;

  it('costs one portion as the sum of quantity x cost_price', () => {
    // 150*0.05 + 20*0.4 + 5*0.01
    expect(previewRecipe(popcorn, BY_ID, 50000).cost).toBe(15.55);
  });

  it('computes margin and margin percent against the selling price', () => {
    const preview = previewRecipe(popcorn, BY_ID, 50000);
    expect(preview.margin).toBe(49984.45);
    expect(preview.marginPercent).toBe(99.97);
  });

  it('the scarcest ingredient decides how many portions stock supports', () => {
    // corn 1000/150 = 6, butter 100/20 = 5, salt 1000/5 = 200
    expect(previewRecipe(popcorn, BY_ID, null)).toMatchObject({ maxServings: 5, limitingId: 2 });
  });

  it('does not lose a portion to floating point (0.3 / 0.1)', () => {
    const flour = new Map([[1, stock({ id: 1, quantity: 0.3 })]]);
    expect(previewRecipe(formWith([['1', '0.1']]).lines, flour, null).maxServings).toBe(3);
  });

  it('has no margin without a price, and no percentage for a free product', () => {
    expect(previewRecipe(popcorn, BY_ID, null)).toMatchObject({
      margin: null,
      marginPercent: null,
    });
    expect(previewRecipe(popcorn, BY_ID, 0)).toMatchObject({ marginPercent: null });
  });

  it('shows nothing until an ingredient with a valid quantity is picked', () => {
    expect(previewRecipe(emptyRecipeForm('1').lines, BY_ID, 100)).toMatchObject({
      cost: 0,
      margin: null,
      maxServings: null,
    });
    expect(
      previewRecipe(
        formWith([
          ['1', 'abc'],
          ['99', '5'],
        ]).lines,
        BY_ID,
        100,
      ).maxServings,
    ).toBeNull();
  });

  it('is 0 portions when an ingredient is out of stock', () => {
    const empty = new Map([[1, stock({ id: 1, quantity: 0 })]]);
    expect(previewRecipe(formWith([['1', '150']]).lines, empty, null).maxServings).toBe(0);
  });
});
