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

  it('createDirector posts FormData to /director', async () => {
    const formData = new FormData();
    await directorsApi.createDirector(formData);
    expect(postMock).toHaveBeenCalledWith('/director', formData);
  });

  describe('buildDirectorFormData', () => {
    it('appends scalar values and the avatar file', () => {
      const formData = directorsApi.buildDirectorFormData(
        { full_name: 'D', bio: '', dob: '', nationality: '' } as any,
        new File(['x'], 'avatar.png'),
      );
      expect(formData.get('full_name')).toBe('D');
      expect(formData.get('avatar_url')).toBeInstanceOf(File);
    });

    it('falls back to the plain avatar_url string when no file is given', () => {
      const formData = directorsApi.buildDirectorFormData({
        full_name: 'D',
        avatar_url: 'https://example.com/d.jpg',
        bio: '',
        dob: '',
        nationality: '',
      });
      expect(formData.get('avatar_url')).toBe('https://example.com/d.jpg');
    });
  });

  it('deleteDirector deletes /director/:id', async () => {
    await directorsApi.deleteDirector(1);
    expect(deleteMock).toHaveBeenCalledWith('/director/1');
  });
});
