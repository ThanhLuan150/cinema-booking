import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const hideReviewMock = vi.fn();
const rejectReviewMock = vi.fn();
const restoreReviewMock = vi.fn();
const deleteReviewMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  hideReview: (...args: unknown[]) => hideReviewMock(...args),
  rejectReview: (...args: unknown[]) => rejectReviewMock(...args),
  restoreReview: (...args: unknown[]) => restoreReviewMock(...args),
  deleteReview: (...args: unknown[]) => deleteReviewMock(...args),
}));

import { useHideReview, useRejectReview, useRestoreReview, useDeleteReview } from './useReviewModeration';

function makeWrapper() {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { wrapper, invalidateSpy };
}

describe('review moderation hooks', () => {
  beforeEach(() => {
    hideReviewMock.mockReset();
    rejectReviewMock.mockReset();
    restoreReviewMock.mockReset();
    deleteReviewMock.mockReset();
  });

  it('useHideReview calls hideReview and invalidates adminReviews', async () => {
    hideReviewMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useHideReview(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(hideReviewMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminReviews'] });
  });

  it('useRejectReview calls rejectReview and invalidates adminReviews', async () => {
    rejectReviewMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRejectReview(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rejectReviewMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminReviews'] });
  });

  it('useRestoreReview calls restoreReview and invalidates adminReviews', async () => {
    restoreReviewMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useRestoreReview(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(restoreReviewMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminReviews'] });
  });

  it('useDeleteReview calls deleteReview and invalidates adminReviews', async () => {
    deleteReviewMock.mockResolvedValue({});
    const { wrapper, invalidateSpy } = makeWrapper();
    const { result } = renderHook(() => useDeleteReview(), { wrapper });
    result.current.mutate(1);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteReviewMock).toHaveBeenCalledWith(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['adminReviews'] });
  });
});
