import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const favoriteCinemaMock = vi.fn();
vi.mock('../api/movies.api', () => ({ favoriteCinema: (...args: unknown[]) => favoriteCinemaMock(...args) }));

import { useFavoriteCinemaMutation } from './useFavoriteCinemaMutation';

describe('useFavoriteCinemaMutation', () => {
  beforeEach(() => favoriteCinemaMock.mockReset());

  it('calls favoriteCinema and invalidates the favorites query on success', async () => {
    favoriteCinemaMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useFavoriteCinemaMutation(), { wrapper });
    result.current.mutate(7);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(favoriteCinemaMock).toHaveBeenCalledWith(7);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myFavoriteCinemas'] });
  });
});
