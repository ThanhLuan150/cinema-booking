import { describe, expect, it } from 'vitest';
import reducer, { bump } from './realtimeSlice';

describe('realtimeSlice', () => {
  it('returns the initial state with all versions at 0', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({
      cinemaStatusVersion: 0,
      ownerBookingVersion: 0,
    });
  });

  it('bump increments only the targeted counter', () => {
    const state = reducer(undefined, bump('cinemaStatusVersion'));
    expect(state.cinemaStatusVersion).toBe(1);
    expect(state.ownerBookingVersion).toBe(0);
  });

  it('bump can be applied repeatedly to the same key', () => {
    let state = reducer(undefined, bump('ownerBookingVersion'));
    state = reducer(state, bump('ownerBookingVersion'));
    expect(state.ownerBookingVersion).toBe(2);
  });
});
