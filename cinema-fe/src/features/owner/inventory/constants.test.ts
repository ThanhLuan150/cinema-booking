import { describe, expect, it } from 'vitest';
import { detailsFromItem, historyTypeOf, isLowStock, HISTORY_TYPES } from './constants';
import type { Inventory } from '@/types/entities';

describe('historyTypeOf', () => {
  it('passes the current types through', () => {
    for (const type of HISTORY_TYPES) expect(historyTypeOf({ type, ref_type: null })).toBe(type);
  });

  it('maps pre-migration rows: RECEIVE->IMPORT, ADJUST->ADJUSTMENT', () => {
    expect(historyTypeOf({ type: 'RECEIVE', ref_type: null })).toBe('IMPORT');
    expect(historyTypeOf({ type: 'ADJUST', ref_type: null })).toBe('ADJUSTMENT');
  });

  it('splits a legacy DEDUCT into SALE (from a combo order) vs WASTE (manual)', () => {
    expect(historyTypeOf({ type: 'DEDUCT', ref_type: 'COMBO_ORDER' })).toBe('SALE');
    expect(historyTypeOf({ type: 'DEDUCT', ref_type: null })).toBe('WASTE');
  });
});

describe('isLowStock', () => {
  it('is true for LOW_STOCK and OUT_OF_STOCK only', () => {
    expect(isLowStock('LOW_STOCK')).toBe(true);
    expect(isLowStock('OUT_OF_STOCK')).toBe(true);
    expect(isLowStock('IN_STOCK')).toBe(false);
  });
});

describe('detailsFromItem', () => {
  const item = {
    id: 1, branch_id: 1, combo_id: 5, item: 'Popcorn', sku: 'POP', category: 'Food', quantity: 9,
    minimum_quantity: 3, unit: 'pcs', cost_price: 10, selling_price: 20, status: 'IN_STOCK',
  } as Inventory;

  it('turns an item into form strings', () => {
    expect(detailsFromItem(item)).toEqual({
      item: 'Popcorn', sku: 'POP', category: 'Food', combo_id: '5', minimum_quantity: '3', unit: 'pcs',
      cost_price: '10', selling_price: '20',
    });
  });

  it('tolerates a legacy row with no sku/category/prices and no combo link', () => {
    const legacy = { ...item, combo_id: null, sku: null, category: undefined, cost_price: undefined, selling_price: undefined };
    expect(detailsFromItem(legacy as unknown as Inventory)).toMatchObject({
      sku: '', category: '', combo_id: '', cost_price: '0', selling_price: '0',
    });
  });
});
