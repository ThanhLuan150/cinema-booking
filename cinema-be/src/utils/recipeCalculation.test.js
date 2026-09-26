const calc = require('./recipeCalculation');

// Large Popcorn: Corn 150g, Butter 20g, Salt 5g — the ticket's own example (ids 1, 2, 3).
const POPCORN = [
  { inventory_id: 1, quantity: 150 },
  { inventory_id: 2, quantity: 20 },
  { inventory_id: 3, quantity: 5 },
];

describe('roundQuantity / roundMoney', () => {
  it('removes binary floating point drift', () => {
    expect(0.1 * 3).not.toBe(0.3); // the problem being solved
    expect(calc.roundQuantity(0.1 * 3)).toBe(0.3);
    expect(calc.roundQuantity(1.0000000000000002)).toBe(1);
  });

  it('keeps six decimals and drops the rest', () => {
    expect(calc.roundQuantity(0.1234567)).toBe(0.123457);
    expect(calc.roundQuantity(150)).toBe(150);
  });

  it('rounds money to cents', () => {
    expect(calc.roundMoney(1.005)).toBe(1.01);
    expect(calc.roundMoney(3.14159)).toBe(3.14);
  });
});

describe('parseIngredientLines', () => {
  it('accepts a valid list and coerces numeric strings', () => {
    const { lines, error } = calc.parseIngredientLines([
      { inventory_id: '1', quantity: '150' },
      { inventory_id: 2, quantity: 0.5 },
    ]);
    expect(error).toBeUndefined();
    expect(lines).toEqual([
      { inventory_id: 1, quantity: 150 },
      { inventory_id: 2, quantity: 0.5 },
    ]);
  });

  it('rejects a non-array', () => {
    expect(calc.parseIngredientLines(undefined).error.code).toBe('VALIDATION_ERROR');
    expect(calc.parseIngredientLines('nope').error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an empty recipe', () => {
    expect(calc.parseIngredientLines([]).error.code).toBe('RECIPE_EMPTY');
  });

  it('rejects more than the maximum number of ingredients', () => {
    const many = Array.from({ length: calc.MAX_INGREDIENTS + 1 }, (_, i) => ({ inventory_id: i + 1, quantity: 1 }));
    expect(calc.parseIngredientLines(many).error.code).toBe('TOO_MANY_INGREDIENTS');
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['text', 'abc'],
    ['empty string', ''],
    ['null', null],
    ['missing', undefined],
    ['absurdly large', 1e12],
    ['rounds to zero on the stock grid', 1e-9],
  ])('rejects a %s quantity', (_label, quantity) => {
    expect(calc.parseIngredientLines([{ inventory_id: 1, quantity }]).error.code).toBe('VALIDATION_ERROR');
  });

  it.each([[undefined], [null], [''], ['abc'], [1.5]])('rejects inventory_id %p', (inventory_id) => {
    expect(calc.parseIngredientLines([{ inventory_id, quantity: 1 }]).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a null line', () => {
    expect(calc.parseIngredientLines([null]).error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects the same ingredient twice', () => {
    const { error } = calc.parseIngredientLines([
      { inventory_id: 1, quantity: 10 },
      { inventory_id: 1, quantity: 20 },
    ]);
    expect(error.code).toBe('DUPLICATE_INGREDIENT');
  });
});

describe('scaleRecipe', () => {
  it('one portion needs exactly the recipe quantities', () => {
    expect([...calc.scaleRecipe(POPCORN, 1)]).toEqual([
      [1, 150],
      [2, 20],
      [3, 5],
    ]);
  });

  it('scales every ingredient by the number of portions (the ticket example: 1 sold = -150/-20/-5)', () => {
    const demand = calc.scaleRecipe(POPCORN, 3);
    expect(demand.get(1)).toBe(450);
    expect(demand.get(2)).toBe(60);
    expect(demand.get(3)).toBe(15);
  });

  it('is exact for fractional quantities that drift in doubles', () => {
    expect(calc.scaleRecipe([{ inventory_id: 1, quantity: 0.1 }], 3).get(1)).toBe(0.3);
    expect(calc.scaleRecipe([{ inventory_id: 1, quantity: 0.07 }], 100).get(1)).toBe(7);
  });

  it('zero portions need nothing', () => {
    expect(calc.scaleRecipe(POPCORN, 0).get(1)).toBe(0);
  });
});

describe('aggregateDemand', () => {
  const NACHOS = [
    { inventory_id: 2, quantity: 30 }, // butter again
    { inventory_id: 4, quantity: 100 },
  ];

  it('sums an ingredient shared by several products so it is checked once, against the combined need', () => {
    const total = calc.aggregateDemand([
      { ingredients: POPCORN, servings: 2, productId: 10 },
      { ingredients: NACHOS, servings: 1, productId: 11 },
    ]);
    expect(total.get(2)).toEqual({ quantity: 70, productIds: [10, 11] }); // 20*2 + 30*1
    expect(total.get(1)).toEqual({ quantity: 300, productIds: [10] });
    expect(total.get(4)).toEqual({ quantity: 100, productIds: [11] });
  });

  it('does not repeat a product id', () => {
    const total = calc.aggregateDemand([
      { ingredients: POPCORN, servings: 1, productId: 10 },
      { ingredients: POPCORN, servings: 2, productId: 10 },
    ]);
    expect(total.get(1)).toEqual({ quantity: 450, productIds: [10] });
  });

  it('is empty for no entries', () => {
    expect(calc.aggregateDemand([]).size).toBe(0);
  });

  it('stays exact when many fractional lines add up', () => {
    const total = calc.aggregateDemand(
      Array.from({ length: 10 }, () => ({ ingredients: [{ inventory_id: 1, quantity: 0.1 }], servings: 1 })),
    );
    expect(total.get(1).quantity).toBe(1);
  });
});

describe('maxServings', () => {
  const stock = (entries) => new Map(entries);

  it('is decided by the scarcest ingredient', () => {
    // corn 1000/150 = 6.6 -> 6, butter 100/20 = 5, salt 1000/5 = 200
    const result = calc.maxServings(POPCORN, stock([[1, 1000], [2, 100], [3, 1000]]));
    expect(result).toEqual({ max: 5, limitingId: 2 });
  });

  it('floors partial portions', () => {
    expect(calc.maxServings(POPCORN, stock([[1, 299], [2, 1000], [3, 1000]])).max).toBe(1);
  });

  it('is exactly the ratio when stock is a whole multiple', () => {
    expect(calc.maxServings(POPCORN, stock([[1, 300], [2, 40], [3, 10]])).max).toBe(2);
  });

  it('does not lose a portion to floating point (0.3 / 0.1 is 2.9999999999999996)', () => {
    expect(0.3 / 0.1).toBeLessThan(3);
    expect(calc.maxServings([{ inventory_id: 1, quantity: 0.1 }], stock([[1, 0.3]])).max).toBe(3);
  });

  it('is 0 when any ingredient is out of stock', () => {
    expect(calc.maxServings(POPCORN, stock([[1, 1000], [2, 0], [3, 1000]]))).toEqual({ max: 0, limitingId: 2 });
  });

  it('is 0 when an ingredient has no stock record', () => {
    expect(calc.maxServings(POPCORN, stock([[1, 1000], [2, 1000]]))).toEqual({ max: 0, limitingId: 3 });
  });

  it('is 0 for a recipe without ingredients', () => {
    expect(calc.maxServings([], stock([]))).toEqual({ max: 0, limitingId: null });
  });
});

describe('findShortfalls', () => {
  it('is empty when everything is covered, boundary included', () => {
    const demand = calc.scaleRecipe(POPCORN, 2);
    expect(calc.findShortfalls(demand, new Map([[1, 300], [2, 40], [3, 10]]))).toEqual([]);
  });

  it('lists only the ingredients that fall short, with requested and available', () => {
    const demand = calc.scaleRecipe(POPCORN, 2);
    const shortfalls = calc.findShortfalls(demand, new Map([[1, 299.5], [2, 400], [3, 9]]));
    expect(shortfalls).toEqual([
      { inventory_id: 1, requested: 300, available: 299.5 },
      { inventory_id: 3, requested: 10, available: 9 },
    ]);
  });

  it('treats a missing stock record as zero available', () => {
    expect(calc.findShortfalls(new Map([[9, 5]]), new Map())).toEqual([{ inventory_id: 9, requested: 5, available: 0 }]);
  });
});

describe('recipeCost / marginOf', () => {
  const costs = new Map([[1, 0.05], [2, 0.4], [3, 0.01]]); // per gram

  it('sums quantity x cost_price per ingredient', () => {
    // 150*0.05 + 20*0.4 + 5*0.01 = 7.5 + 8 + 0.05
    expect(calc.recipeCost(POPCORN, costs)).toBe(15.55);
  });

  it('counts an unknown ingredient as free rather than failing', () => {
    expect(calc.recipeCost(POPCORN, new Map([[1, 0.05]]))).toBe(7.5);
  });

  it('is 0 for no ingredients', () => {
    expect(calc.recipeCost([], costs)).toBe(0);
  });

  it('computes margin and percent of the selling price', () => {
    expect(calc.marginOf(50000, 15550)).toEqual({ margin: 34450, marginPercent: 68.9 });
  });

  it('gives a negative margin when cost exceeds price', () => {
    expect(calc.marginOf(10, 12.5)).toEqual({ margin: -2.5, marginPercent: -25 });
  });

  it('has no percentage for a free product', () => {
    expect(calc.marginOf(0, 5)).toEqual({ margin: -5, marginPercent: null });
  });
});
