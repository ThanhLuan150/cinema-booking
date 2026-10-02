import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const patchMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    patch: (...args: unknown[]) => patchMock(...args),
  },
}));

import { getKdsBoard, getKdsBranches, updateKdsStatus } from './kds.api';

describe('kds.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: { orders: [] } });
    patchMock.mockReset().mockResolvedValue({ data: { id: 5, status: 'PREPARING' } });
  });

  it('getKdsBranches lists the branches the caller may open', async () => {
    getMock.mockResolvedValue({ data: [{ id: 1, active: 2 }] });
    expect(await getKdsBranches()).toEqual([{ id: 1, active: 2 }]);
    expect(getMock).toHaveBeenCalledWith('/kds/branches');
  });

  it('getKdsBoard reads the board of one branch and unwraps the body', async () => {
    expect(await getKdsBoard(3)).toEqual({ orders: [] });
    expect(getMock).toHaveBeenCalledWith('/kds/branches/3/orders', {
      params: { status: undefined, recentMinutes: undefined },
    });
  });

  it('getKdsBoard sends the status filter as a comma list', async () => {
    await getKdsBoard(3, { status: ['NEW', 'READY'], recentMinutes: 30 });
    expect(getMock).toHaveBeenCalledWith('/kds/branches/3/orders', {
      params: { status: 'NEW,READY', recentMinutes: 30 },
    });
  });

  it('updateKdsStatus patches only the status (no price can travel)', async () => {
    expect(await updateKdsStatus(3, 5, { status: 'PREPARING' })).toEqual({
      id: 5,
      status: 'PREPARING',
    });
    expect(patchMock).toHaveBeenCalledWith('/kds/branches/3/orders/5/status', {
      status: 'PREPARING',
    });
  });

  it('updateKdsStatus forwards a cancel reason', async () => {
    await updateKdsStatus(3, 5, { status: 'CANCELLED', reason: 'Machine broken' });
    expect(patchMock).toHaveBeenCalledWith('/kds/branches/3/orders/5/status', {
      status: 'CANCELLED',
      reason: 'Machine broken',
    });
  });
});
