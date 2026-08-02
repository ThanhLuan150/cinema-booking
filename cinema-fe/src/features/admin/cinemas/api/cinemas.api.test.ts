import { describe, expect, it, vi, beforeEach } from 'vitest';

const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: { put: (...args: unknown[]) => putMock(...args), delete: (...args: unknown[]) => deleteMock(...args) },
}));

import * as cinemasApi from './cinemas.api';

describe('admin cinemas.api', () => {
  beforeEach(() => {
    putMock.mockReset();
    deleteMock.mockReset();
  });

  it('approveCinema puts to /cinema/:id/approve', async () => {
    await cinemasApi.approveCinema(1);
    expect(putMock).toHaveBeenCalledWith('/cinema/1/approve');
  });

  it('blockCinema puts to /cinema/:id/block', async () => {
    await cinemasApi.blockCinema(1);
    expect(putMock).toHaveBeenCalledWith('/cinema/1/block');
  });

  it('deleteCinema deletes /cinema/:id', async () => {
    await cinemasApi.deleteCinema(1);
    expect(deleteMock).toHaveBeenCalledWith('/cinema/1');
  });
});
