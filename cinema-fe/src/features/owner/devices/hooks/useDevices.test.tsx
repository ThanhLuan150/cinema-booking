import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getDevicesMock = vi.fn();
const getEntrancesMock = vi.fn();
const getCheckinLogsMock = vi.fn();
vi.mock('../api/devices.api', () => ({
  getDevices: (...args: unknown[]) => getDevicesMock(...args),
  getEntrances: (...args: unknown[]) => getEntrancesMock(...args),
  getCheckinLogs: (...args: unknown[]) => getCheckinLogsMock(...args),
}));

import { useDevices } from './useDevices';
import { useEntrances } from './useEntrances';
import { useCheckinLogs } from './useCheckinLogs';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const emptyPage = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };

describe('devices hooks', () => {
  beforeEach(() => {
    getDevicesMock.mockReset().mockResolvedValue(emptyPage);
    getEntrancesMock.mockReset().mockResolvedValue(emptyPage);
    getCheckinLogsMock.mockReset().mockResolvedValue(emptyPage);
  });

  it('useDevices fetches for a branch with filters', async () => {
    const { result } = renderHook(() => useDevices(1, 2, 10, { status: 'ACTIVE' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDevicesMock).toHaveBeenCalledWith(1, { page: 2, limit: 10, status: 'ACTIVE' });
  });

  it('useDevices is disabled without a branchId', () => {
    const { result } = renderHook(() => useDevices(undefined, 1, 10), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getDevicesMock).not.toHaveBeenCalled();
  });

  it('useEntrances fetches for a branch', async () => {
    const { result } = renderHook(() => useEntrances(3, 1, 100), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getEntrancesMock).toHaveBeenCalledWith(3, { page: 1, limit: 100 });
  });

  it('useCheckinLogs fetches with a device filter', async () => {
    const { result } = renderHook(() => useCheckinLogs(1, 1, 10, { deviceId: 7 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCheckinLogsMock).toHaveBeenCalledWith(1, { page: 1, limit: 10, deviceId: 7 });
  });
});
