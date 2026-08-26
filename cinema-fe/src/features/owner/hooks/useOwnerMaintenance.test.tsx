import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getMaintenanceRequestsMock = vi.fn();
vi.mock('../api/owner.api', () => ({ getMaintenanceRequests: (...args: unknown[]) => getMaintenanceRequestsMock(...args) }));

import { useOwnerMaintenance } from './useOwnerMaintenance';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOwnerMaintenance', () => {
  beforeEach(() => getMaintenanceRequestsMock.mockReset());

  it('fetches maintenance requests for the given branch/page/limit/status', async () => {
    getMaintenanceRequestsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerMaintenance(1, 1, 20, 'OPEN'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMaintenanceRequestsMock).toHaveBeenCalledWith(1, { page: 1, limit: 20, status: 'OPEN' });
  });

  it('does not fetch when branchId is undefined and enabled is not overridden', () => {
    const { result } = renderHook(() => useOwnerMaintenance(undefined, 1, 20), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMaintenanceRequestsMock).not.toHaveBeenCalled();
  });

  it('fetches when explicitly enabled even without a branchId (admin "all branches" view)', async () => {
    getMaintenanceRequestsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useOwnerMaintenance(undefined, 1, 20, undefined, { enabled: true }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMaintenanceRequestsMock).toHaveBeenCalledWith(undefined, { page: 1, limit: 20, status: undefined });
  });
});
