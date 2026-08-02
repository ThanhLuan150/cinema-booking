import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const unfavoriteCinemaMock = vi.fn();
vi.mock('../api/movies.api', () => ({ unfavoriteCinema: (...args: unknown[]) => unfavoriteCinemaMock(...args) }));

import { useUnfavoriteCinemaMutation } from './useUnfavoriteCinemaMutation';

describe('useUnfavoriteCinemaMutation', () => {
  beforeEach(() => unfavoriteCinemaMock.mockReset());

  it('calls unfavoriteCinema and invalidates the favorites query on success', async () => {
    unfavoriteCinemaMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useUnfavoriteCinemaMutation(), { wrapper });
    result.current.mutate(7);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(unfavoriteCinemaMock).toHaveBeenCalledWith(7);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myFavoriteCinemas'] });
  });
});
