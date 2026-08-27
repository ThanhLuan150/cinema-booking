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

import * as devicesApi from './devices.api';

describe('devices.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
    postMock.mockResolvedValue({ data: {} });
  });

  it('getEntrances gets /entrance with branchId and params', async () => {
    await devicesApi.getEntrances(1, { page: 1, status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/entrance', { params: { branchId: 1, page: 1, status: 'ACTIVE' } });
  });

  it('createEntrance posts /entrance', async () => {
    await devicesApi.createEntrance({ branch_id: 1, name: 'Lobby' });
    expect(postMock).toHaveBeenCalledWith('/entrance', { branch_id: 1, name: 'Lobby' });
  });

  it('updateEntrance / deleteEntrance target /entrance/:id', async () => {
    await devicesApi.updateEntrance(3, { name: 'Gate B' });
    expect(putMock).toHaveBeenCalledWith('/entrance/3', { name: 'Gate B' });
    await devicesApi.deleteEntrance(3);
    expect(deleteMock).toHaveBeenCalledWith('/entrance/3');
  });

  it('getDevices gets /devices with branchId and params', async () => {
    await devicesApi.getDevices(2, { page: 1, status: 'ACTIVE', entranceId: 9 });
    expect(getMock).toHaveBeenCalledWith('/devices', { params: { branchId: 2, page: 1, status: 'ACTIVE', entranceId: 9 } });
  });

  it('createDevice posts /devices and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { id: 1, device_id: 'SCN-1', api_key: 'DEV-x' } });
    const res = await devicesApi.createDevice({ branch_id: 1, device_id: 'SCN-1', name: 'S' });
    expect(postMock).toHaveBeenCalledWith('/devices', { branch_id: 1, device_id: 'SCN-1', name: 'S' });
    expect(res.api_key).toBe('DEV-x');
  });

  it('updateDevice puts /devices/:id', async () => {
    await devicesApi.updateDevice(5, { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith('/devices/5', { status: 'INACTIVE' });
  });

  it('rotateDeviceKey posts /devices/:id/rotate-key and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { api_key: 'DEV-new' } });
    const res = await devicesApi.rotateDeviceKey(5);
    expect(postMock).toHaveBeenCalledWith('/devices/5/rotate-key');
    expect(res.api_key).toBe('DEV-new');
  });

  it('deleteDevice deletes /devices/:id', async () => {
    await devicesApi.deleteDevice(5);
    expect(deleteMock).toHaveBeenCalledWith('/devices/5');
  });

  it('getCheckinLogs gets /devices/logs with filters', async () => {
    await devicesApi.getCheckinLogs(1, { deviceId: 5, result: 'REJECTED' });
    expect(getMock).toHaveBeenCalledWith('/devices/logs', { params: { branchId: 1, deviceId: 5, result: 'REJECTED' } });
  });
});
