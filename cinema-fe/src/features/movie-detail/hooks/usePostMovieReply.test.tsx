import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const postMovieReplyMock = vi.fn();
vi.mock('../api/reviews.api', () => ({
  postMovieReply: (...args: unknown[]) => postMovieReplyMock(...args),
}));

import { usePostMovieReply } from './usePostMovieReply';

describe('usePostMovieReply', () => {
  beforeEach(() => postMovieReplyMock.mockReset());

  it("posts the reply and invalidates that movie's reviews query", async () => {
    postMovieReplyMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { movie_id: 5, parent_id: 1, comment: 'Hi' } as any;
    const { result } = renderHook(() => usePostMovieReply(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postMovieReplyMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['movieReviews', '5'] });
  });
});
