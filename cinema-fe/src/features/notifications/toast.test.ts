import { describe, expect, it, vi, beforeEach } from 'vitest';

const dispatchMock = vi.fn();
vi.mock('@/app/store', () => ({ store: { dispatch: (...args: unknown[]) => dispatchMock(...args) } }));

import { toast } from './toast';
import { showToast } from './notificationSlice';

describe('toast', () => {
  beforeEach(() => {
    dispatchMock.mockReset();
  });

  it('dispatches showToast with the default "info" type', () => {
    toast('Hello');
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: showToast.type,
        payload: expect.objectContaining({ message: 'Hello', type: 'info' }),
      }),
    );
  });

  it('dispatches showToast with an explicit type', () => {
    toast('Uh oh', 'error');
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: showToast.type,
        payload: expect.objectContaining({ message: 'Uh oh', type: 'error' }),
      }),
    );
  });

  it('toast.success dispatches with type "success"', () => {
    toast.success('Saved');
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: showToast.type,
        payload: expect.objectContaining({ message: 'Saved', type: 'success' }),
      }),
    );
  });

  it('toast.error dispatches with type "error"', () => {
    toast.error('Failed');
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: showToast.type,
        payload: expect.objectContaining({ message: 'Failed', type: 'error' }),
      }),
    );
  });

  it('toast.info dispatches with type "info"', () => {
    toast.info('FYI');
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: showToast.type,
        payload: expect.objectContaining({ message: 'FYI', type: 'info' }),
      }),
    );
  });
});
