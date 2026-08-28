import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as api from './systemConfig.api';

describe('systemConfig.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: {} });
    putMock.mockReset().mockResolvedValue({ data: {} });
    deleteMock.mockReset().mockResolvedValue({ data: {} });
  });

  it('getSystemConfigMeta gets /system-config/meta', async () => {
    await api.getSystemConfigMeta();
    expect(getMock).toHaveBeenCalledWith('/system-config/meta');
  });

  it('getSystemConfigList gets /system-config with no params for the Global view', async () => {
    await api.getSystemConfigList();
    expect(getMock).toHaveBeenCalledWith('/system-config', { params: undefined });
  });

  it('getSystemConfigList passes branchId for a branch view', async () => {
    await api.getSystemConfigList({ branchId: 7 });
    expect(getMock).toHaveBeenCalledWith('/system-config', { params: { branchId: 7 } });
  });

  it('getSystemConfigByKey gets /system-config/:key', async () => {
    await api.getSystemConfigByKey('BOOKING_HOLD_TIME');
    expect(getMock).toHaveBeenCalledWith('/system-config/BOOKING_HOLD_TIME', { params: undefined });
  });

  it('getSystemConfigByKey passes branchId when given', async () => {
    await api.getSystemConfigByKey('BOOKING_HOLD_TIME', 7);
    expect(getMock).toHaveBeenCalledWith('/system-config/BOOKING_HOLD_TIME', { params: { branchId: 7 } });
  });

  it('updateSystemConfig puts the payload to /system-config/:key', async () => {
    await api.updateSystemConfig('BOOKING_HOLD_TIME', { value: 10, branchId: null });
    expect(putMock).toHaveBeenCalledWith('/system-config/BOOKING_HOLD_TIME', { value: 10, branchId: null });
  });

  it('resetSystemConfig deletes /system-config/:key with branchId', async () => {
    await api.resetSystemConfig('BOOKING_HOLD_TIME', 7);
    expect(deleteMock).toHaveBeenCalledWith('/system-config/BOOKING_HOLD_TIME', { params: { branchId: 7 } });
  });

  it('resetSystemConfig omits params when no branchId is given', async () => {
    await api.resetSystemConfig('BOOKING_HOLD_TIME');
    expect(deleteMock).toHaveBeenCalledWith('/system-config/BOOKING_HOLD_TIME', { params: undefined });
  });
});
