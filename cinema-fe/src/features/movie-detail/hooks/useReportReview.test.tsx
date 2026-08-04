import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const reportReviewMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  reportReview: (...args: unknown[]) => reportReviewMock(...args),
}));

import { useReportReview } from './useReportReview';

describe('useReportReview (movie-detail)', () => {
  beforeEach(() => reportReviewMock.mockReset());

  it('reports the review and invalidates the movie reviews query', async () => {
    reportReviewMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const { result } = renderHook(() => useReportReview(5), { wrapper });
    result.current.mutate({ reviewId: 10, reason: 'spam' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(reportReviewMock).toHaveBeenCalledWith(10, 'spam');
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieReviews', '5'] });
  });
});
