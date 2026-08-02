import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getCinemaByIdMock = vi.fn();
vi.mock('@/features/movies/api/movies.api', () => ({ getCinemaById: (...args: unknown[]) => getCinemaByIdMock(...args) }));

import { useCinemaDetail } from './useCinemaDetail';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useCinemaDetail', () => {
  beforeEach(() => getCinemaByIdMock.mockReset());

  it('is disabled when cinemaId is undefined', () => {
    const { result } = renderHook(() => useCinemaDetail(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the cinema when cinemaId is provided', async () => {
    getCinemaByIdMock.mockResolvedValue({ id: 1, name: 'Cinema A' });
    const { result } = renderHook(() => useCinemaDetail(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getCinemaByIdMock).toHaveBeenCalledWith(1);
  });
});
