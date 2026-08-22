import { describe, expect, it } from 'vitest';
import reducer, { closeAddModal, openAddModal } from './ownerHolidaysSlice';

describe('ownerHolidaysSlice', () => {
  it('returns the initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ showAddModal: false });
  });

  it('opens and closes the add modal', () => {
    const opened = reducer(undefined, openAddModal());
    expect(opened.showAddModal).toBe(true);
    const closed = reducer(opened, closeAddModal());
    expect(closed.showAddModal).toBe(false);
  });
});
