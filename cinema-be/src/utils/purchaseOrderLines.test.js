const { parseLines, buildOrderItems, roundMoney, MAX_LINES, MAX_TOTAL } = require('./purchaseOrderLines');

const product = (overrides = {}) => ({ id: 1, branch_id: 1, item: 'Popcorn', sku: 'POP', unit: 'kg', cost_price: 10, ...overrides });
const byId = (...products) => new Map(products.map((p) => [p.id, p]));

describe('parseLines', () => {
  it('accepts numeric strings and leaves a missing unit_cost undefined', () => {
    expect(parseLines([{ inventory_id: '3', quantity: '2.5' }])).toEqual({
      lines: [{ inventory_id: 3, quantity: 2.5, unit_cost: undefined }],
    });
  });

  it.each([
    ['a non-array', 'x', 'VALIDATION_ERROR'],
    ['null', null, 'VALIDATION_ERROR'],
    ['a null line', [null], 'VALIDATION_ERROR'],
    ['a fractional inventory_id', [{ inventory_id: 1.5, quantity: 1 }], 'VALIDATION_ERROR'],
    ['zero quantity', [{ inventory_id: 1, quantity: 0 }], 'VALIDATION_ERROR'],
    ['negative quantity', [{ inventory_id: 1, quantity: -1 }], 'VALIDATION_ERROR'],
    ['NaN quantity', [{ inventory_id: 1, quantity: 'abc' }], 'VALIDATION_ERROR'],
    ['Infinity quantity', [{ inventory_id: 1, quantity: Infinity }], 'VALIDATION_ERROR'],
    ['an absurd quantity', [{ inventory_id: 1, quantity: 1e12 }], 'VALIDATION_ERROR'],
    ['negative cost', [{ inventory_id: 1, quantity: 1, unit_cost: -0.01 }], 'VALIDATION_ERROR'],
    ['a text cost', [{ inventory_id: 1, quantity: 1, unit_cost: 'free' }], 'VALIDATION_ERROR'],
    ['a repeated product', [{ inventory_id: 1, quantity: 1 }, { inventory_id: 1, quantity: 1 }], 'DUPLICATE_LINE'],
    ['too many lines', Array.from({ length: MAX_LINES + 1 }, (_, i) => ({ inventory_id: i + 1, quantity: 1 })), 'TOO_MANY_LINES'],
  ])('rejects %s', (_label, input, code) => {
    expect(parseLines(input).error.code).toBe(code);
  });

  it('allows a free (zero-cost) line', () => {
    expect(parseLines([{ inventory_id: 1, quantity: 1, unit_cost: 0 }]).lines[0].unit_cost).toBe(0);
  });
});

describe('buildOrderItems', () => {
  it('snapshots the product, defaults cost to cost_price, and totals the lines', () => {
    const { items, total } = buildOrderItems(
      [{ inventory_id: 1, quantity: 3, unit_cost: undefined }, { inventory_id: 2, quantity: 2, unit_cost: 7.5 }],
      byId(product(), product({ id: 2, item: 'Cola', sku: null, unit: 'can', cost_price: 99 })),
      1,
    );
    expect(items).toEqual([
      { inventory_id: 1, item: 'Popcorn', sku: 'POP', unit: 'kg', quantity: 3, unit_cost: 10, line_total: 30 },
      { inventory_id: 2, item: 'Cola', sku: null, unit: 'can', quantity: 2, unit_cost: 7.5, line_total: 15 },
    ]);
    expect(total).toBe(45);
  });

  it('honours an explicit zero cost instead of falling back to cost_price', () => {
    const { items } = buildOrderItems([{ inventory_id: 1, quantity: 2, unit_cost: 0 }], byId(product()), 1);
    expect(items[0]).toMatchObject({ unit_cost: 0, line_total: 0 });
  });

  it('rounds money to 2 decimals so floating point never leaks into the total', () => {
    const { total } = buildOrderItems(
      [{ inventory_id: 1, quantity: 3, unit_cost: 0.1 }, { inventory_id: 2, quantity: 3, unit_cost: 0.2 }],
      byId(product(), product({ id: 2 })),
      1,
    );
    expect(total).toBe(0.9); // 3*0.1 + 3*0.2 is 0.9000000000000001 in raw doubles
  });

  it('refuses a missing product and a product from another branch', () => {
    expect(buildOrderItems([{ inventory_id: 9, quantity: 1 }], byId(product()), 1).error.code).toBe('INVENTORY_NOT_FOUND');
    expect(buildOrderItems([{ inventory_id: 1, quantity: 1 }], byId(product({ branch_id: 2 })), 1).error.code).toBe(
      'INVENTORY_BRANCH_MISMATCH',
    );
  });

  it('refuses a total beyond the cap', () => {
    const lines = [{ inventory_id: 1, quantity: 1e9, unit_cost: 1e12 }];
    expect(buildOrderItems(lines, byId(product()), 1).error.code).toBe('TOTAL_TOO_LARGE');
    expect(MAX_TOTAL).toBeLessThan(1e9 * 1e12);
  });
});

describe('roundMoney', () => {
  it('rounds to cents', () => {
    expect(roundMoney(1.239)).toBe(1.24);
    expect(roundMoney(1.231)).toBe(1.23);
    expect(roundMoney(0)).toBe(0);
  });
});
