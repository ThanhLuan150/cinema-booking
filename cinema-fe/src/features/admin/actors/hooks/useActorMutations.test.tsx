import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createActorMock = vi.fn();
const deleteActorMock = vi.fn();
const buildActorFormDataMock = vi.fn();
vi.mock('../api/actors.api', () => ({
  createActor: (...args: unknown[]) => createActorMock(...args),
  deleteActor: (...args: unknown[]) => deleteActorMock(...args),
  buildActorFormData: (...args: unknown[]) => buildActorFormDataMock(...args),
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
    buildActorFormDataMock.mockReset();
  });

  it('useCreateActor creates and invalidates actors', async () => {
    const formData = new FormData();
    buildActorFormDataMock.mockReturnValue(formData);
    createActorMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateActor(), { wrapper });
    result.current.mutate({ full_name: 'A', avatar_url: '', bio: '', dob: '', nationality: '' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(createActorMock).toHaveBeenCalledWith(formData);
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
