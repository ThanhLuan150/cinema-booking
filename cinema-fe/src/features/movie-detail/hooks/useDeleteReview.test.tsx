import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const deleteReviewMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  deleteReview: (...args: unknown[]) => deleteReviewMock(...args),
}));

import { useDeleteReview } from './useDeleteReview';

describe('useDeleteReview (movie-detail)', () => {
  beforeEach(() => deleteReviewMock.mockReset());

  it('calls deleteReview and invalidates the movie reviews query', async () => {
    deleteReviewMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useDeleteReview(5), { wrapper });
    result.current.mutate(10);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteReviewMock).toHaveBeenCalledWith(10);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieReviews', '5'] });
  });
});
