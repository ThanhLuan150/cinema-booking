import { describe, expect, it, beforeEach } from 'vitest';
import { store } from '@/app/store';
import { closeConfirm } from './confirmSlice';
import { confirmDialog, resolveConfirm } from './confirm';

describe('confirmDialog / resolveConfirm', () => {
  beforeEach(() => {
    store.dispatch(closeConfirm());
  });

  it('dispatches openConfirm with the message and options', () => {
    confirmDialog('Are you sure?', { confirmLabel: 'Yes' });
    const request = store.getState().confirm.request;
    expect(request).toMatchObject({ message: 'Are you sure?', confirmLabel: 'Yes' });
  });

  it('resolves the promise with the result passed to resolveConfirm', async () => {
    const promise = confirmDialog('Delete this?');
    const id = store.getState().confirm.request!.id;
    resolveConfirm(id, true);
    await expect(promise).resolves.toBe(true);
  });

  it('resolveConfirm clears the request from the store', () => {
    confirmDialog('Delete this?');
    const id = store.getState().confirm.request!.id;
    resolveConfirm(id, false);
    expect(store.getState().confirm.request).toBeNull();
  });

  it('resolveConfirm is a no-op for an unknown id', () => {
    expect(() => resolveConfirm(999999, true)).not.toThrow();
  });
});
