import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getListMock = vi.fn();
const getMetaMock = vi.fn();
const updateMock = vi.fn();
const resetMock = vi.fn();
vi.mock('../api/systemConfig.api', () => ({
  getSystemConfigList: (...a: unknown[]) => getListMock(...a),
  getSystemConfigMeta: (...a: unknown[]) => getMetaMock(...a),
  updateSystemConfig: (...a: unknown[]) => updateMock(...a),
  resetSystemConfig: (...a: unknown[]) => resetMock(...a),
}));

import { useSystemConfigList, useSystemConfigMeta } from './useSystemConfig';
import { useResetSystemConfig, useUpdateSystemConfig } from './useSystemConfigMutations';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('systemConfig hooks', () => {
  beforeEach(() => {
    getListMock.mockReset().mockResolvedValue({ branchId: null, settings: [] });
    getMetaMock.mockReset().mockResolvedValue({ settings: [] });
    updateMock.mockReset().mockResolvedValue({ key: 'BOOKING_HOLD_TIME', value: 10 });
    resetMock.mockReset().mockResolvedValue({ key: 'BOOKING_HOLD_TIME', value: 5 });
  });

  it('useSystemConfigList forwards branchId', async () => {
    const { result } = renderHook(() => useSystemConfigList({ branchId: 7 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getListMock).toHaveBeenCalledWith({ branchId: 7 });
  });

  it('useSystemConfigMeta loads the registry', async () => {
    const { result } = renderHook(() => useSystemConfigMeta(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMetaMock).toHaveBeenCalled();
  });

  it('useUpdateSystemConfig splits key from the payload', async () => {
    const { result } = renderHook(() => useUpdateSystemConfig(), { wrapper });
    await result.current.mutateAsync({ key: 'BOOKING_HOLD_TIME', value: 10, branchId: null });
    expect(updateMock).toHaveBeenCalledWith('BOOKING_HOLD_TIME', { value: 10, branchId: null });
  });

  it('useResetSystemConfig calls the api with key + branchId', async () => {
    const { result } = renderHook(() => useResetSystemConfig(), { wrapper });
    await result.current.mutateAsync({ key: 'BOOKING_HOLD_TIME', branchId: 7 });
    expect(resetMock).toHaveBeenCalledWith('BOOKING_HOLD_TIME', 7);
  });
});
