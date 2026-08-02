import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const getCinemasListMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getCinemasList: (...args: unknown[]) => getCinemasListMock(...args) }));

import { useCinemasList } from './useCinemasList';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCinemasList', () => {
  beforeEach(() => getCinemasListMock.mockReset());

  it('fetches the full cinema list with a large limit', async () => {
    getCinemasListMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useCinemasList(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCinemasListMock).toHaveBeenCalledWith({ limit: FULL_LIST_FETCH_LIMIT });
  });
});
