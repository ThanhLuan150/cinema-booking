import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getTopCinemasMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getTopCinemas: () => getTopCinemasMock() }));

import { useTopCinemas } from './useTopCinemas';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useTopCinemas', () => {
  beforeEach(() => getTopCinemasMock.mockReset());

  it('fetches the top-ranked cinemas', async () => {
    getTopCinemasMock.mockResolvedValue([{ id: 1, name: 'Cinema A' }]);
    const { result } = renderHook(() => useTopCinemas(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 1, name: 'Cinema A' }]);
  });
});
