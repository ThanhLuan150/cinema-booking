import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getActorsMock = vi.fn();
vi.mock('../api/actors.api', () => ({ getActors: (...args: unknown[]) => getActorsMock(...args) }));

import { useActors, useActorsCatalog } from './useActors';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useActors', () => {
  beforeEach(() => getActorsMock.mockReset());

  it('fetches actors for the given page/limit', async () => {
    getActorsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useActors(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getActorsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('useActorsCatalog fetches the full unpaginated list', async () => {
    getActorsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useActorsCatalog(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getActorsMock).toHaveBeenCalledWith({ limit: 100 });
  });
});
