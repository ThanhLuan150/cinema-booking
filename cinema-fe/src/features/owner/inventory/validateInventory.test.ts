import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { validateInventoryDetails } from './validateInventory';
import { emptyInventoryDetails } from './constants';

const t = ((key: string) => key) as unknown as TFunction;
const valid = { ...emptyInventoryDetails(), item: 'Popcorn', unit: 'pcs' };

describe('validateInventoryDetails', () => {
  it('accepts a minimal valid item (blank SKU, zero prices)', () => {
    expect(validateInventoryDetails(valid, t)).toEqual({});
  });

  it('requires a name and a unit', () => {
    expect(validateInventoryDetails({ ...valid, item: '  ', unit: '' }, t)).toEqual({
      item: 'inventory.validation.itemRequired',
      unit: 'inventory.validation.unitRequired',
    });
  });

  it.each(['a b', 'a$b', '-lead', 'x'.repeat(41)])('rejects the SKU %j', (sku) => {
    expect(validateInventoryDetails({ ...valid, sku }, t).sku).toBe('inventory.validation.skuInvalid');
  });

  it.each(['POP-L', 'pop.l_2', 'A'])('accepts the SKU %j', (sku) => {
    expect(validateInventoryDetails({ ...valid, sku }, t).sku).toBeUndefined();
  });

  it('rejects negative or non-numeric prices and minimum stock', () => {
    const errors = validateInventoryDetails(
      { ...valid, cost_price: '-1', selling_price: 'abc', minimum_quantity: '-3' },
      t,
    );
    expect(errors).toEqual({
      cost_price: 'inventory.validation.priceInvalid',
      selling_price: 'inventory.validation.priceInvalid',
      minimum_quantity: 'inventory.validation.minQuantityInvalid',
    });
  });

  it('treats a blank number as "0" (not an error) and rejects Infinity', () => {
    expect(validateInventoryDetails({ ...valid, cost_price: '', minimum_quantity: '' }, t)).toEqual({});
    expect(validateInventoryDetails({ ...valid, cost_price: 'Infinity' }, t).cost_price).toBeDefined();
  });

  it('rejects an over-long category', () => {
    expect(validateInventoryDetails({ ...valid, category: 'c'.repeat(61) }, t).category).toBe(
      'inventory.validation.categoryTooLong',
    );
  });
});
