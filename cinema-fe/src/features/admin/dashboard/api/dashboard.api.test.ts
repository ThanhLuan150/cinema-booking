import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
vi.mock('services/apiClient', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

import { getAdminDashboardStats } from './dashboard.api';

describe('admin dashboard.api', () => {
  beforeEach(() => getMock.mockReset());

  it('getAdminDashboardStats gets /admin/dashboard', async () => {
    getMock.mockResolvedValue({ data: {} });
    await getAdminDashboardStats();
    expect(getMock).toHaveBeenCalledWith('/admin/dashboard');
  });
});
