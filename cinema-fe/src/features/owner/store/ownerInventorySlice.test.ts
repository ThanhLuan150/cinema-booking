import { describe, expect, it } from 'vitest';
import reducer, {
  closeAddModal,
  closeHistory,
  closeStockAction,
  openAddModal,
  openHistory,
  openStockAction,
} from './ownerInventorySlice';

describe('ownerInventorySlice', () => {
  it('returns the initial state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ showAddModal: false, stockAction: null, historyItemId: null });
  });

  it('opens and closes the add modal', () => {
    const opened = reducer(undefined, openAddModal());
    expect(opened.showAddModal).toBe(true);
    const closed = reducer(opened, closeAddModal());
    expect(closed.showAddModal).toBe(false);
  });

  it('opens and closes a stock action', () => {
    const opened = reducer(undefined, openStockAction({ id: 5, mode: 'receive' }));
    expect(opened.stockAction).toEqual({ id: 5, mode: 'receive' });
    const closed = reducer(opened, closeStockAction());
    expect(closed.stockAction).toBeNull();
  });

  it('opens and closes the history modal for an item', () => {
    const opened = reducer(undefined, openHistory(7));
    expect(opened.historyItemId).toBe(7);
    const closed = reducer(opened, closeHistory());
    expect(closed.historyItemId).toBeNull();
  });
});
