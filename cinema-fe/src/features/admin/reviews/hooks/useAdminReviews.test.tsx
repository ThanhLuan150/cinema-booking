import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAdminReviewsMock = vi.fn();
vi.mock('../api/reviews.api', () => ({ getAdminReviews: (...args: unknown[]) => getAdminReviewsMock(...args) }));

import { useAdminReviews } from './useAdminReviews';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useAdminReviews', () => {
  beforeEach(() => getAdminReviewsMock.mockReset());

  it('fetches reviews for the given page/limit', async () => {
    getAdminReviewsMock.mockResolvedValue({ data: [], total: 0 });
    const { result } = renderHook(() => useAdminReviews(1, 20), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAdminReviewsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });
});
