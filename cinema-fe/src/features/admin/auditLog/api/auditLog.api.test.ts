import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

import * as auditLogApi from './auditLog.api';

describe('auditLog.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: {} });
  });

  it('getAuditLogs gets /audit-logs with pagination + filters and unwraps data', async () => {
    getMock.mockResolvedValue({ data: { data: [], total: 0, page: 1, limit: 20, totalPages: 1 } });
    await auditLogApi.getAuditLogs({ page: 2, limit: 20, branchId: 3, action: 'CREATE_MOVIE' });
    expect(getMock).toHaveBeenCalledWith('/audit-logs', {
      params: { page: 2, limit: 20, branchId: 3, action: 'CREATE_MOVIE' },
    });
  });

  it('getAuditLogMeta gets /audit-logs/meta', async () => {
    getMock.mockResolvedValue({ data: { actions: [], entityTypes: [] } });
    await auditLogApi.getAuditLogMeta();
    expect(getMock).toHaveBeenCalledWith('/audit-logs/meta');
  });
});
