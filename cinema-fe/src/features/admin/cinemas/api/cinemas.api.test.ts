import { describe, expect, it, vi, beforeEach } from 'vitest';

const putMock = vi.fn();
const deleteMock = vi.fn();
const postMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    post: (...args: unknown[]) => postMock(...args),
  },
}));

import * as cinemasApi from './cinemas.api';

describe('admin cinemas.api', () => {
  beforeEach(() => {
    putMock.mockReset();
    deleteMock.mockReset();
    postMock.mockReset();
  });

  it('activateCinema puts to /cinema/:id/activate', async () => {
    await cinemasApi.activateCinema(1);
    expect(putMock).toHaveBeenCalledWith('/cinema/1/activate');
  });

  it('disableCinema puts to /cinema/:id/disable', async () => {
    await cinemasApi.disableCinema(1);
    expect(putMock).toHaveBeenCalledWith('/cinema/1/disable');
  });

  it('setCinemaMaintenance puts to /cinema/:id/maintenance', async () => {
    await cinemasApi.setCinemaMaintenance(1);
    expect(putMock).toHaveBeenCalledWith('/cinema/1/maintenance');
  });

  it('deleteCinema deletes /cinema/:id', async () => {
    await cinemasApi.deleteCinema(1);
    expect(deleteMock).toHaveBeenCalledWith('/cinema/1');
  });

  it('createBranchAdmin posts to /cinema/branch-admin', async () => {
    const payload = {
      email: 'a@b.com',
      password: 'pw',
      name: 'A',
      phone: '',
      cinema_name: 'Cinema A',
      code: 'A',
      address: '',
      city: '',
    };
    await cinemasApi.createBranchAdmin(payload);
    expect(postMock).toHaveBeenCalledWith('/cinema/branch-admin', payload);
  });
});
