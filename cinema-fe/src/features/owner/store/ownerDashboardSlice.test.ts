import { describe, expect, it } from 'vitest';
import reducer, { setSelectedbranchId } from './ownerDashboardSlice';

describe('ownerDashboardSlice', () => {
  it('returns the initial state with an empty selected cinema id', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ selectedbranchId: '' });
  });

  it('setSelectedbranchId updates the selected cinema id', () => {
    const state = reducer(undefined, setSelectedbranchId('cinema-1'));
    expect(state.selectedbranchId).toBe('cinema-1');
  });
});
