import { describe, expect, it } from 'vitest';
import type { ConfirmRequest } from './types/confirm.types';
import reducer, { closeConfirm, openConfirm } from './confirmSlice';

describe('confirmSlice', () => {
  it('returns the initial state with no request', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ request: null });
  });

  it('openConfirm stores the request', () => {
    const request = { message: 'Are you sure?' } as unknown as ConfirmRequest;
    const state = reducer(undefined, openConfirm(request));
    expect(state.request).toEqual(request);
  });

  it('closeConfirm clears the request', () => {
    const request = { message: 'Are you sure?' } as unknown as ConfirmRequest;
    const opened = reducer(undefined, openConfirm(request));
    const state = reducer(opened, closeConfirm());
    expect(state.request).toBeNull();
  });
});
