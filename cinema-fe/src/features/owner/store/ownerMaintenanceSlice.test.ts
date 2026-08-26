import { describe, expect, it } from 'vitest';
import reducer, {
  closeAddModal,
  closeAssignModal,
  closeResolveModal,
  openAddModal,
  openAssignModal,
  openResolveModal,
  setSelectedbranchId,
} from './ownerMaintenanceSlice';

describe('ownerMaintenanceSlice', () => {
  it('returns the initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({
      selectedbranchId: '',
      showAddModal: false,
      assignRequestId: null,
      resolveRequestId: null,
    });
  });

  it('sets the selected branch', () => {
    const state = reducer(undefined, setSelectedbranchId('3'));
    expect(state.selectedbranchId).toBe('3');
  });

  it('opens and closes the add modal', () => {
    const opened = reducer(undefined, openAddModal());
    expect(opened.showAddModal).toBe(true);
    const closed = reducer(opened, closeAddModal());
    expect(closed.showAddModal).toBe(false);
  });

  it('opens and closes the assign modal for a request', () => {
    const opened = reducer(undefined, openAssignModal(7));
    expect(opened.assignRequestId).toBe(7);
    const closed = reducer(opened, closeAssignModal());
    expect(closed.assignRequestId).toBeNull();
  });

  it('opens and closes the resolve modal for a request', () => {
    const opened = reducer(undefined, openResolveModal(9));
    expect(opened.resolveRequestId).toBe(9);
    const closed = reducer(opened, closeResolveModal());
    expect(closed.resolveRequestId).toBeNull();
  });
});
