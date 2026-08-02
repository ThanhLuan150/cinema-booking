import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getLikeStatusMock = vi.fn();
vi.mock('../api/movies.api', () => ({ getLikeStatus: (...args: unknown[]) => getLikeStatusMock(...args) }));

import { useLikeStatus, likeStatusQueryKey } from './useLikeStatus';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('likeStatusQueryKey', () => {
  it('builds a key scoped to the movie id', () => {
    expect(likeStatusQueryKey(5)).toEqual(['like', 5]);
  });
});

describe('useLikeStatus', () => {
  beforeEach(() => getLikeStatusMock.mockReset());

  it('is disabled for a falsy movieId', () => {
    const { result } = renderHook(() => useLikeStatus(0), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the like count for a movie', async () => {
    getLikeStatusMock.mockResolvedValue(3);
    const { result } = renderHook(() => useLikeStatus(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3);
  });
});
