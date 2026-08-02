import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const postCinemaReplyMock = vi.fn();
vi.mock('../api/reviews.api', () => ({ postCinemaReply: (...args: unknown[]) => postCinemaReplyMock(...args) }));

import { usePostCinemaReply } from './usePostCinemaReply';

describe('usePostCinemaReply', () => {
  beforeEach(() => postCinemaReplyMock.mockReset());

  it('posts the reply and invalidates that cinema\'s reviews query', async () => {
    postCinemaReplyMock.mockResolvedValue({ data: {} });
    const client = new QueryClient();
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    function wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    }
    const payload = { cinema_id: 5, parent_id: 1, comment: 'Hi' } as any;
    const { result } = renderHook(() => usePostCinemaReply(), { wrapper });
    result.current.mutate(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(postCinemaReplyMock).toHaveBeenCalledWith(payload);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cinemaReviews', '5'] });
  });
});
