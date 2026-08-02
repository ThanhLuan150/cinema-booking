import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const approveCinemaMock = vi.fn();
const blockCinemaMock = vi.fn();
const deleteCinemaMock = vi.fn();
vi.mock('../api/cinemas.api', () => ({
  approveCinema: (...args: unknown[]) => approveCinemaMock(...args),
  blockCinema: (...args: unknown[]) => blockCinemaMock(...args),
  deleteCinema: (...args: unknown[]) => deleteCinemaMock(...args),
}));

import { useApproveCinema, useBlockCinema, useDeleteCinema } from './useCinemaModeration';

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
    approveCinemaMock.mockReset();
    blockCinemaMock.mockReset();
    deleteCinemaMock.mockReset();
  });

  it('useApproveCinema calls approveCinema and invalidates adminCinemas', async () => {
    approveCinemaMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useApproveCinema(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(approveCinemaMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminCinemas'] });
  });

  it('useBlockCinema calls blockCinema and invalidates adminCinemas', async () => {
    blockCinemaMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useBlockCinema(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(blockCinemaMock).toHaveBeenCalledWith(1);
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
});
