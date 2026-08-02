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

import * as usersApi from './users.api';

describe('admin users.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getUsers gets /users with pagination', async () => {
    await usersApi.getUsers({ page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/users', { params: { page: 1 } });
  });

  it('getUserById gets /users/:id', async () => {
    await usersApi.getUserById(5);
    expect(getMock).toHaveBeenCalledWith('/users/5');
  });

  it('blockUser puts /block/:id', async () => {
    await usersApi.blockUser(5);
    expect(putMock).toHaveBeenCalledWith('/block/5');
  });

  it('unblockUser puts /unblock/:id with a status payload', async () => {
    await usersApi.unblockUser(5, { status: 1 });
    expect(putMock).toHaveBeenCalledWith('/unblock/5', { status: 1 });
  });

  it('deleteUser deletes /users/:id', async () => {
    await usersApi.deleteUser(5);
    expect(deleteMock).toHaveBeenCalledWith('/users/5');
  });

  it('updateUserRole puts /users/:id/role', async () => {
    await usersApi.updateUserRole(5, 2);
    expect(putMock).toHaveBeenCalledWith('/users/5/role', { role: 2 });
  });

  it('approveUser puts /users/:id/approve', async () => {
    await usersApi.approveUser(5);
    expect(putMock).toHaveBeenCalledWith('/users/5/approve');
  });
});
