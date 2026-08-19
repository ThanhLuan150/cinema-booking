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

  it('createActor posts FormData to /actor', async () => {
    const formData = new FormData();
    await actorsApi.createActor(formData);
    expect(postMock).toHaveBeenCalledWith('/actor', formData);
  });

  describe('buildActorFormData', () => {
    it('appends scalar values and the avatar file', () => {
      const formData = actorsApi.buildActorFormData(
        { full_name: 'A', bio: '', dob: '', nationality: '' } as any,
        new File(['x'], 'avatar.png'),
      );
      expect(formData.get('full_name')).toBe('A');
      expect(formData.get('avatar_url')).toBeInstanceOf(File);
    });

    it('falls back to the plain avatar_url string when no file is given', () => {
      const formData = actorsApi.buildActorFormData({
        full_name: 'A',
        avatar_url: 'https://example.com/a.jpg',
        bio: '',
        dob: '',
        nationality: '',
      });
      expect(formData.get('avatar_url')).toBe('https://example.com/a.jpg');
    });
  });

  it('deleteActor deletes /actor/:id', async () => {
    await actorsApi.deleteActor(1);
    expect(deleteMock).toHaveBeenCalledWith('/actor/1');
  });
});
