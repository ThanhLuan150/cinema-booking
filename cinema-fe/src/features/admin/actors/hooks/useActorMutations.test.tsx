import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createActorMock = vi.fn();
const deleteActorMock = vi.fn();
vi.mock('../api/actors.api', () => ({
  createActor: (...args: unknown[]) => createActorMock(...args),
  deleteActor: (...args: unknown[]) => deleteActorMock(...args),
}));

import { useCreateActor, useDeleteActor } from './useActorMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('actor mutation hooks', () => {
  beforeEach(() => {
    createActorMock.mockReset();
    deleteActorMock.mockReset();
  });

  it('useCreateActor creates and invalidates actors', async () => {
    createActorMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateActor(), { wrapper });
    result.current.mutate({ full_name: 'A', avatar_url: '', bio: '', dob: '', nationality: '' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['actors'] });
  });

  it('useDeleteActor deletes and invalidates actors', async () => {
    deleteActorMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteActor(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteActorMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['actors'] });
  });
});
