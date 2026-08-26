import { describe, expect, it } from 'vitest';
import { store } from './store';

describe('store', () => {
  it('registers all expected top-level reducer keys', () => {
    const state = store.getState();
    expect(Object.keys(state).sort()).toEqual(
      [
        'auth',
        'booking',
        'movies',
        'adminMovies',
        'ownerDashboard',
        'ownerCinemas',
        'ownerCombos',
        'ownerInventory',
        'ownerVouchers',
        'ownerPromotions',
        'ownerPricingRules',
        'ownerHolidays',
        'ownerEmployees',
        'ownerShifts',
        'ownerMaintenance',
        'adminActors',
        'adminDirectors',
        'notifications',
        'realtime',
        'confirm',
      ].sort(),
    );
  });

  it('does not throw when dispatching an unknown action', () => {
    expect(() => store.dispatch({ type: 'unknown/action' })).not.toThrow();
  });
});
