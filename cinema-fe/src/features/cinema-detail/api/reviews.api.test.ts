import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as reviewsApi from './reviews.api';

describe('cinema-detail reviews.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getCinemaReviews gets /review/cinema/:id', async () => {
    await reviewsApi.getCinemaReviews(5);
    expect(getMock).toHaveBeenCalledWith('/review/cinema/5');
  });

  it('postCinemaReview posts to /review', async () => {
    const payload = { cinema_id: 5, rating: 4 } as any;
    await reviewsApi.postCinemaReview(payload);
    expect(postMock).toHaveBeenCalledWith('/review', payload);
  });

  it('postCinemaReply posts to /review', async () => {
    const payload = { cinema_id: 5, parent_id: 1, comment: 'Hi' } as any;
    await reviewsApi.postCinemaReply(payload);
    expect(postMock).toHaveBeenCalledWith('/review', payload);
  });

  it('postReviewReaction posts to /review/:id/react', async () => {
    await reviewsApi.postReviewReaction(1, 'like');
    expect(postMock).toHaveBeenCalledWith('/review/1/react', { type: 'like' });
  });

  it('updateReview puts to /review/:id', async () => {
    const payload = { rating: 5, comment: 'Great' } as any;
    await reviewsApi.updateReview(1, payload);
    expect(putMock).toHaveBeenCalledWith('/review/1', payload);
  });

  it('deleteReview deletes /review/:id', async () => {
    await reviewsApi.deleteReview(1);
    expect(deleteMock).toHaveBeenCalledWith('/review/1');
  });

  it('reportReview posts to /review/:id/report', async () => {
    await reviewsApi.reportReview(1, 'spam');
    expect(postMock).toHaveBeenCalledWith('/review/1/report', { reason: 'spam' });
  });
});
