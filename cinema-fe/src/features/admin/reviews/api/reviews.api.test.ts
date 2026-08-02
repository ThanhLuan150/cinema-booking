import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as reviewsApi from './reviews.api';

describe('admin reviews.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getAdminReviews gets /review with pagination', async () => {
    await reviewsApi.getAdminReviews({ page: 1, limit: 10 } as any);
    expect(getMock).toHaveBeenCalledWith('/review', { params: { page: 1, limit: 10 } });
  });

  it('hideReview puts /review/:id/hide', async () => {
    await reviewsApi.hideReview(1);
    expect(putMock).toHaveBeenCalledWith('/review/1/hide');
  });

  it('deleteReview deletes /review/:id', async () => {
    await reviewsApi.deleteReview(1);
    expect(deleteMock).toHaveBeenCalledWith('/review/1');
  });
});
