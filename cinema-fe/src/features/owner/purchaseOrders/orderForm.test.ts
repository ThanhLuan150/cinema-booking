import { describe, expect, it } from 'vitest';
import type { Inventory, PurchaseOrder } from '@/types/entities';
import {
  displayDay,
  emptyOrderForm,
  lineTotal,
  newLine,
  orderToForm,
  orderTotal,
  todayISO,
  toDateInput,
  toPayload,
  validateOrderForm,
  type OrderForm,
} from './orderForm';

const product = (overrides: Partial<Inventory> = {}): Inventory => ({
  id: 1,
  branch_id: 1,
  combo_id: null,
  item: 'Popcorn',
  sku: 'POP',
  category: '',
  quantity: 10,
  minimum_quantity: 2,
  unit: 'kg',
  cost_price: 100,
  selling_price: 0,
  status: 'IN_STOCK',
  ...overrides,
});

const valid = (overrides: Partial<OrderForm> = {}): OrderForm => ({
  branch_id: '1',
  supplier_id: '2',
  order_date: '2026-10-10',
  expected_date: '',
  note: '',
  lines: [newLine({ inventory_id: '1', quantity: '5' })],
  ...overrides,
});

describe('validateOrderForm', () => {
  it('accepts a complete form', () => {
    expect(validateOrderForm(valid())).toEqual({});
  });

  it('requires a branch and a supplier', () => {
    expect(validateOrderForm(valid({ branch_id: '', supplier_id: '' }))).toMatchObject({
      branch_id: 'branchRequired',
      supplier_id: 'supplierRequired',
    });
  });

  it('ignores untouched rows but demands lines when asked to', () => {
    const blank = valid({ lines: [newLine(), newLine()] });
    expect(validateOrderForm(blank)).toEqual({});
    expect(validateOrderForm(blank, { requireLines: true }).lines).toBe('linesRequired');
  });

  it.each([
    ['zero quantity', { inventory_id: '1', quantity: '0' }],
    ['negative quantity', { inventory_id: '1', quantity: '-3' }],
    ['non-numeric quantity', { inventory_id: '1', quantity: 'abc' }],
    ['quantity without a product', { inventory_id: '', quantity: '4' }],
    ['a product without a quantity', { inventory_id: '1', quantity: '' }],
  ])('flags %s', (_label, line) => {
    expect(validateOrderForm(valid({ lines: [newLine(line)] })).lines).toBe('lineInvalid');
  });

  it('flags a negative unit cost but allows a blank one and a free (0) one', () => {
    expect(
      validateOrderForm(
        valid({ lines: [newLine({ inventory_id: '1', quantity: '1', unit_cost: '-1' })] }),
      ).lines,
    ).toBe('costInvalid');
    expect(
      validateOrderForm(
        valid({ lines: [newLine({ inventory_id: '1', quantity: '1', unit_cost: '' })] }),
      ),
    ).toEqual({});
    expect(
      validateOrderForm(
        valid({ lines: [newLine({ inventory_id: '1', quantity: '1', unit_cost: '0' })] }),
      ),
    ).toEqual({});
  });

  it('flags the same product on two lines', () => {
    const lines = [
      newLine({ inventory_id: '1', quantity: '1' }),
      newLine({ inventory_id: '1', quantity: '2' }),
    ];
    expect(validateOrderForm(valid({ lines })).lines).toBe('duplicateLine');
  });

  it('rejects an expected date before the order date, accepts the same day', () => {
    expect(validateOrderForm(valid({ expected_date: '2026-10-09' })).expected_date).toBe(
      'expectedBeforeOrder',
    );
    expect(validateOrderForm(valid({ expected_date: '2026-10-10' }))).toEqual({});
  });
});

describe('toPayload', () => {
  it('coerces strings, drops blank rows, and omits a blank unit cost so the server defaults it', () => {
    const form = valid({
      expected_date: '2026-10-20',
      note: '  urgent  ',
      lines: [
        newLine({ inventory_id: '1', quantity: '5', unit_cost: '' }),
        newLine({ inventory_id: '2', quantity: '2.5', unit_cost: '7' }),
        newLine(),
      ],
    });
    expect(toPayload(form)).toEqual({
      branch_id: 1,
      supplier_id: 2,
      order_date: '2026-10-10',
      expected_date: '2026-10-20',
      note: 'urgent',
      items: [
        { inventory_id: 1, quantity: 5 },
        { inventory_id: 2, quantity: 2.5, unit_cost: 7 },
      ],
    });
  });

  it('sends a null expected date when none was chosen', () => {
    expect(toPayload(valid()).expected_date).toBeNull();
  });

  it('never sends a total — the server computes it', () => {
    expect(Object.keys(toPayload(valid()))).not.toContain('total_amount');
  });
});

describe('totals', () => {
  const byId = new Map([
    [1, product()],
    [2, product({ id: 2, cost_price: 0 })],
  ]);

  it('uses an explicit unit cost, else the product cost price', () => {
    expect(lineTotal(newLine({ inventory_id: '1', quantity: '3' }), byId)).toBe(300);
    expect(lineTotal(newLine({ inventory_id: '1', quantity: '3', unit_cost: '50' }), byId)).toBe(
      150,
    );
    expect(lineTotal(newLine({ inventory_id: '1', quantity: '3', unit_cost: '0' }), byId)).toBe(0);
  });

  it('is 0 for an unusable quantity or an unknown product', () => {
    expect(lineTotal(newLine({ inventory_id: '1', quantity: '' }), byId)).toBe(0);
    expect(lineTotal(newLine({ inventory_id: '1', quantity: '-2' }), byId)).toBe(0);
    expect(lineTotal(newLine({ inventory_id: '99', quantity: '2' }), byId)).toBe(0);
  });

  it('sums the lines', () => {
    const lines = [
      newLine({ inventory_id: '1', quantity: '2' }),
      newLine({ inventory_id: '2', quantity: '5', unit_cost: '4' }),
    ];
    expect(orderTotal(lines, byId)).toBe(220);
  });
});

describe('dates', () => {
  it('formats today as a local YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(todayISO(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('shows the saved calendar day back unchanged, whatever the timezone', () => {
    expect(toDateInput('2026-10-10T00:00:00.000Z')).toBe('2026-10-10');
    expect(toDateInput(null)).toBe('');
    // A date-only value must render as the 10th, not slide to the 9th west of UTC.
    expect(displayDay('2026-10-10T00:00:00.000Z', 'en')).toContain('10');
    expect(displayDay(null)).toBe('—');
  });
});

describe('form <-> order', () => {
  it('starts with one empty line and today as the order date', () => {
    const form = emptyOrderForm('7');
    expect(form).toMatchObject({
      branch_id: '7',
      supplier_id: '',
      order_date: todayISO(),
      expected_date: '',
    });
    expect(form.lines).toHaveLength(1);
  });

  it('loads a saved order back into editable strings', () => {
    const order = {
      branch_id: 1,
      supplier_id: 2,
      order_date: '2026-10-10T00:00:00.000Z',
      expected_date: null,
      note: 'hi',
      items: [
        {
          inventory_id: 1,
          item: 'Popcorn',
          sku: null,
          unit: 'kg',
          quantity: 5,
          unit_cost: 9,
          line_total: 45,
        },
      ],
    } as unknown as PurchaseOrder;
    const form = orderToForm(order);
    expect(form).toMatchObject({
      branch_id: '1',
      supplier_id: '2',
      order_date: '2026-10-10',
      expected_date: '',
      note: 'hi',
    });
    expect(form.lines[0]).toMatchObject({ inventory_id: '1', quantity: '5', unit_cost: '9' });
  });
});
