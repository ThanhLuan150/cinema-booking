import { describe, expect, it } from 'vitest';
import type { MovieFilters } from '../types/movie.types';
import reducer, { resetFilters, setFilters } from './moviesSlice';

describe('moviesSlice', () => {
  it('returns the initial state with empty filters', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ filters: {} });
  });

  it('setFilters replaces the filters object', () => {
    const filters = { genre: 'action' } as unknown as MovieFilters;
    const state = reducer(undefined, setFilters(filters));
    expect(state.filters).toEqual(filters);
  });

  it('resetFilters clears filters when called without a payload', () => {
    const dirty = reducer(undefined, setFilters({ genre: 'action' } as unknown as MovieFilters));
    const state = reducer(dirty, resetFilters(undefined));
    expect(state.filters).toEqual({});
  });

  it('resetFilters sets filters to the provided payload', () => {
    const filters = { genre: 'comedy' } as unknown as MovieFilters;
    const state = reducer(undefined, resetFilters(filters));
    expect(state.filters).toEqual(filters);
  });
});
