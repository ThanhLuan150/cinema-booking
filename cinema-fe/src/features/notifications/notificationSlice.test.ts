import { describe, expect, it } from 'vitest';
import reducer, { dismissToast, showToast } from './notificationSlice';

describe('notificationSlice', () => {
  it('returns the initial state with no toasts', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.toasts).toEqual([]);
  });

  it('showToast appends a toast with an incrementing id and default type', () => {
    const first = reducer(undefined, showToast('Saved'));
    expect(first.toasts).toHaveLength(1);
    expect(first.toasts[0]).toMatchObject({ message: 'Saved', type: 'info' });

    const second = reducer(first, showToast('Failed', 'error'));
    expect(second.toasts).toHaveLength(2);
    expect(second.toasts[1]).toMatchObject({ message: 'Failed', type: 'error' });
    expect(second.toasts[1].id).not.toBe(first.toasts[0].id);
  });

  it('dismissToast removes the toast with the matching id', () => {
    const withToast = reducer(undefined, showToast('Saved'));
    const id = withToast.toasts[0].id;
    const state = reducer(withToast, dismissToast(id));
    expect(state.toasts).toEqual([]);
  });

  it('dismissToast leaves other toasts untouched', () => {
    const first = reducer(undefined, showToast('One'));
    const second = reducer(first, showToast('Two'));
    const idToRemove = second.toasts[0].id;
    const state = reducer(second, dismissToast(idToRemove));
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].message).toBe('Two');
  });
});
