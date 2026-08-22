import { describe, expect, it } from 'vitest';
import reducer, { closeAddModal, openAddModal, openEditModal, closeEditModal } from './ownerPricingRulesSlice';

describe('ownerPricingRulesSlice', () => {
  it('returns the initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ showAddModal: false, editingRuleId: null });
  });

  it('opens and closes the add modal', () => {
    const opened = reducer(undefined, openAddModal());
    expect(opened.showAddModal).toBe(true);
    const closed = reducer(opened, closeAddModal());
    expect(closed.showAddModal).toBe(false);
  });

  it('opens and closes the edit modal for a specific rule', () => {
    const opened = reducer(undefined, openEditModal(7));
    expect(opened.editingRuleId).toBe(7);
    const closed = reducer(opened, closeEditModal());
    expect(closed.editingRuleId).toBeNull();
  });
});
