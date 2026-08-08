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

import * as actorsApi from './actors.api';

describe('actors.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getActors gets /actor', async () => {
    await actorsApi.getActors({ page: 1, limit: 20 });
    expect(getMock).toHaveBeenCalledWith('/actor', { params: { page: 1, limit: 20 } });
  });

  it('createActor posts to /actor', async () => {
    const payload = { full_name: 'A', avatar_url: '', bio: '', dob: '', nationality: '' };
    await actorsApi.createActor(payload);
    expect(postMock).toHaveBeenCalledWith('/actor', payload);
  });

  it('deleteActor deletes /actor/:id', async () => {
    await actorsApi.deleteActor(1);
    expect(deleteMock).toHaveBeenCalledWith('/actor/1');
  });
});
