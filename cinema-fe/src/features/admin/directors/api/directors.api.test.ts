import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as directorsApi from './directors.api';

describe('directors.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getDirectors gets /director', async () => {
    await directorsApi.getDirectors({ page: 1, limit: 20 });
    expect(getMock).toHaveBeenCalledWith('/director', { params: { page: 1, limit: 20 } });
  });

  it('createDirector posts to /director', async () => {
    const payload = { full_name: 'D', avatar_url: '', bio: '', dob: '', nationality: '' };
    await directorsApi.createDirector(payload);
    expect(postMock).toHaveBeenCalledWith('/director', payload);
  });

  it('deleteDirector deletes /director/:id', async () => {
    await directorsApi.deleteDirector(1);
    expect(deleteMock).toHaveBeenCalledWith('/director/1');
  });
});
