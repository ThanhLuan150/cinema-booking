import { describe, expect, it } from 'vitest';
import reducer, { closeAddModal, openAddModal, setSelectedbranchId } from './ownerEmployeesSlice';

describe('ownerEmployeesSlice', () => {
  it('returns the initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ selectedbranchId: '', showAddModal: false });
  });

  it('sets the selected cinema id', () => {
    const state = reducer(undefined, setSelectedbranchId('5'));
    expect(state.selectedbranchId).toBe('5');
  });

  it('opens and closes the add modal', () => {
    const opened = reducer(undefined, openAddModal());
    expect(opened.showAddModal).toBe(true);
    const closed = reducer(opened, closeAddModal());
    expect(closed.showAddModal).toBe(false);
  });
});
