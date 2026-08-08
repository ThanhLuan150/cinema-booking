import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getDirectorsMock = vi.fn();
vi.mock('../api/directors.api', () => ({ getDirectors: (...args: unknown[]) => getDirectorsMock(...args) }));

import { useDirectors, useDirectorsCatalog } from './useDirectors';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useDirectors', () => {
  beforeEach(() => getDirectorsMock.mockReset());

  it('fetches directors for the given page/limit', async () => {
    getDirectorsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useDirectors(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDirectorsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('useDirectorsCatalog fetches the full unpaginated list', async () => {
    getDirectorsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useDirectorsCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getDirectorsMock).toHaveBeenCalledWith({ limit: 100 });
  });
});
