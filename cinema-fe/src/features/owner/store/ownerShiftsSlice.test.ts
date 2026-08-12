import { describe, expect, it } from 'vitest';
import reducer, {
  closeAddModal,
  closeAssignModal,
  closeEditModal,
  openAddModal,
  openAssignModal,
  openEditModal,
  setSelectedbranchId,
} from './ownerShiftsSlice';

describe('ownerShiftsSlice', () => {
  it('returns the initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({
      selectedbranchId: '',
      showAddModal: false,
      editingShiftId: null,
      showAssignModal: false,
    });
  });

  it('sets the selected branch id', () => {
    const state = reducer(undefined, setSelectedbranchId('5'));
    expect(state.selectedbranchId).toBe('5');
  });

  it('opens and closes the add modal', () => {
    const opened = reducer(undefined, openAddModal());
    expect(opened.showAddModal).toBe(true);
    const closed = reducer(opened, closeAddModal());
    expect(closed.showAddModal).toBe(false);
  });

  it('opens and closes the edit modal for a given shift id', () => {
    const opened = reducer(undefined, openEditModal(3));
    expect(opened.editingShiftId).toBe(3);
    const closed = reducer(opened, closeEditModal());
    expect(closed.editingShiftId).toBeNull();
  });

  it('opens and closes the assign modal', () => {
    const opened = reducer(undefined, openAssignModal());
    expect(opened.showAssignModal).toBe(true);
    const closed = reducer(opened, closeAssignModal());
    expect(closed.showAssignModal).toBe(false);
  });
});
