import { describe, expect, it } from 'vitest';
import reducer, { setSelectedCinemaId } from './ownerDashboardSlice';

describe('ownerDashboardSlice', () => {
  it('returns the initial state with an empty selected cinema id', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ selectedCinemaId: '' });
  });

  it('setSelectedCinemaId updates the selected cinema id', () => {
    const state = reducer(undefined, setSelectedCinemaId('cinema-1'));
    expect(state.selectedCinemaId).toBe('cinema-1');
  });
});
