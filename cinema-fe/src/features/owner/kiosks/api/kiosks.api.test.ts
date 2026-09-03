import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as kiosksApi from './kiosks.api';

describe('kiosks.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: {} });
    postMock.mockReset().mockResolvedValue({ data: {} });
    putMock.mockReset().mockResolvedValue({ data: {} });
    deleteMock.mockReset().mockResolvedValue({ data: {} });
  });

  it('getKiosks gets /kiosks with branchId and params', async () => {
    await kiosksApi.getKiosks(2, { page: 1, status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/kiosks', { params: { branchId: 2, page: 1, status: 'ACTIVE' } });
  });

  it('createKiosk posts /kiosks and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { id: 1, kiosk_code: 'KSK-1', api_key: 'KIOSK-x' } });
    const res = await kiosksApi.createKiosk({ branch_id: 1, kiosk_code: 'KSK-1', name: 'K' });
    expect(postMock).toHaveBeenCalledWith('/kiosks', { branch_id: 1, kiosk_code: 'KSK-1', name: 'K' });
    expect(res.api_key).toBe('KIOSK-x');
  });

  it('updateKiosk puts /kiosks/:id', async () => {
    await kiosksApi.updateKiosk(5, { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith('/kiosks/5', { status: 'INACTIVE' });
  });

  it('rotateKioskKey posts /kiosks/:id/rotate-key and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { api_key: 'KIOSK-new' } });
    const res = await kiosksApi.rotateKioskKey(5);
    expect(postMock).toHaveBeenCalledWith('/kiosks/5/rotate-key');
    expect(res.api_key).toBe('KIOSK-new');
  });

  it('deleteKiosk deletes /kiosks/:id', async () => {
    await kiosksApi.deleteKiosk(5);
    expect(deleteMock).toHaveBeenCalledWith('/kiosks/5');
  });
});
