import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const activateCinemaMock = vi.fn();
const disableCinemaMock = vi.fn();
const setCinemaMaintenanceMock = vi.fn();
const deleteCinemaMock = vi.fn();
const createBranchAdminMock = vi.fn();
vi.mock('../api/cinemas.api', () => ({
  activateCinema: (...args: unknown[]) => activateCinemaMock(...args),
  disableCinema: (...args: unknown[]) => disableCinemaMock(...args),
  setCinemaMaintenance: (...args: unknown[]) => setCinemaMaintenanceMock(...args),
  deleteCinema: (...args: unknown[]) => deleteCinemaMock(...args),
  createBranchAdmin: (...args: unknown[]) => createBranchAdminMock(...args),
}));

import {
  useActivateCinema,
  useDisableCinema,
  useSetCinemaMaintenance,
  useDeleteCinema,
  useCreateBranchAdmin,
} from './useCinemaModeration';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('cinema moderation hooks', () => {
  beforeEach(() => {
    activateCinemaMock.mockReset();
    disableCinemaMock.mockReset();
    setCinemaMaintenanceMock.mockReset();
    deleteCinemaMock.mockReset();
    createBranchAdminMock.mockReset();
  });

  it('useActivateCinema calls activateCinema and invalidates adminCinemas', async () => {
    activateCinemaMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useActivateCinema(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(activateCinemaMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminCinemas'] });
  });

  it('useDisableCinema calls disableCinema and invalidates adminCinemas', async () => {
    disableCinemaMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDisableCinema(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(disableCinemaMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminCinemas'] });
  });

  it('useSetCinemaMaintenance calls setCinemaMaintenance and invalidates adminCinemas', async () => {
    setCinemaMaintenanceMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useSetCinemaMaintenance(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(setCinemaMaintenanceMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminCinemas'] });
  });

  it('useDeleteCinema calls deleteCinema and invalidates adminCinemas', async () => {
    deleteCinemaMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteCinema(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteCinemaMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminCinemas'] });
  });

  it('useCreateBranchAdmin calls createBranchAdmin and invalidates adminCinemas', async () => {
    createBranchAdminMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateBranchAdmin(), { wrapper });
    const payload = {
      email: 'a@b.com',
      password: 'pw',
      name: '',
      phone: '',
      cinema_name: 'A',
      code: 'A',
      address: '',
      city: '',
    };
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createBranchAdminMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminCinemas'] });
  });
});
