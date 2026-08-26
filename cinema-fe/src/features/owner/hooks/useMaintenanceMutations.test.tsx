import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createMaintenanceRequestMock = vi.fn();
const assignMaintenanceRequestMock = vi.fn();
const startMaintenanceRequestMock = vi.fn();
const resolveMaintenanceRequestMock = vi.fn();
const closeMaintenanceRequestMock = vi.fn();
const deleteMaintenanceRequestMock = vi.fn();
vi.mock('../api/owner.api', () => ({
  createMaintenanceRequest: (...args: unknown[]) => createMaintenanceRequestMock(...args),
  assignMaintenanceRequest: (...args: unknown[]) => assignMaintenanceRequestMock(...args),
  startMaintenanceRequest: (...args: unknown[]) => startMaintenanceRequestMock(...args),
  resolveMaintenanceRequest: (...args: unknown[]) => resolveMaintenanceRequestMock(...args),
  closeMaintenanceRequest: (...args: unknown[]) => closeMaintenanceRequestMock(...args),
  deleteMaintenanceRequest: (...args: unknown[]) => deleteMaintenanceRequestMock(...args),
}));

import {
  useAssignMaintenanceRequest,
  useCloseMaintenanceRequest,
  useCreateMaintenanceRequest,
  useDeleteMaintenanceRequest,
  useResolveMaintenanceRequest,
  useStartMaintenanceRequest,
} from './useMaintenanceMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('maintenance mutation hooks', () => {
  beforeEach(() => {
    createMaintenanceRequestMock.mockReset();
    assignMaintenanceRequestMock.mockReset();
    startMaintenanceRequestMock.mockReset();
    resolveMaintenanceRequestMock.mockReset();
    closeMaintenanceRequestMock.mockReset();
    deleteMaintenanceRequestMock.mockReset();
  });

  it('useCreateMaintenanceRequest posts the payload and invalidates the list', async () => {
    createMaintenanceRequestMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateMaintenanceRequest(), { wrapper });
    const payload = { branch_id: 1, resource_type: 'ROOM' as const, room_id: 1, title: 'Flicker' };
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createMaintenanceRequestMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerMaintenance'] });
  });

  it('useAssignMaintenanceRequest posts employee_id for the given id', async () => {
    assignMaintenanceRequestMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useAssignMaintenanceRequest(), { wrapper });
    result.current.mutate({ id: 1, employee_id: 5 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(assignMaintenanceRequestMock).toHaveBeenCalledWith(1, { employee_id: 5 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerMaintenance'] });
  });

  it('useStartMaintenanceRequest posts to start and invalidates', async () => {
    startMaintenanceRequestMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useStartMaintenanceRequest(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(startMaintenanceRequestMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerMaintenance'] });
  });

  it('useResolveMaintenanceRequest posts the resolution note', async () => {
    resolveMaintenanceRequestMock.mockResolvedValue({});
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResolveMaintenanceRequest(), { wrapper });
    result.current.mutate({ id: 1, resolution_note: 'Replaced the bulb' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(resolveMaintenanceRequestMock).toHaveBeenCalledWith(1, { resolution_note: 'Replaced the bulb' });
  });

  it('useCloseMaintenanceRequest posts to close and invalidates', async () => {
    closeMaintenanceRequestMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCloseMaintenanceRequest(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(closeMaintenanceRequestMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerMaintenance'] });
  });

  it('useDeleteMaintenanceRequest deletes and invalidates', async () => {
    deleteMaintenanceRequestMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteMaintenanceRequest(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteMaintenanceRequestMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['ownerMaintenance'] });
  });
});
