import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createDirectorMock = vi.fn();
const deleteDirectorMock = vi.fn();
vi.mock('../api/directors.api', () => ({
  createDirector: (...args: unknown[]) => createDirectorMock(...args),
  deleteDirector: (...args: unknown[]) => deleteDirectorMock(...args),
}));

import { useCreateDirector, useDeleteDirector } from './useDirectorMutations';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('director mutation hooks', () => {
  beforeEach(() => {
    createDirectorMock.mockReset();
    deleteDirectorMock.mockReset();
  });

  it('useCreateDirector creates and invalidates directors', async () => {
    createDirectorMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useCreateDirector(), { wrapper });
    result.current.mutate({ full_name: 'D', avatar_url: '', bio: '', dob: '', nationality: '' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['directors'] });
  });

  it('useDeleteDirector deletes and invalidates directors', async () => {
    deleteDirectorMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteDirector(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteDirectorMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['directors'] });
  });
});
