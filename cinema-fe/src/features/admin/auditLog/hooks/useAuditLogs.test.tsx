import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getAuditLogsMock = vi.fn();
const getAuditLogMetaMock = vi.fn();
vi.mock('../api/auditLog.api', () => ({
  getAuditLogs: (...args: unknown[]) => getAuditLogsMock(...args),
  getAuditLogMeta: (...args: unknown[]) => getAuditLogMetaMock(...args),
}));

import { useAuditLogs, useAuditLogMeta } from './useAuditLogs';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const emptyPage = { data: [], total: 0, page: 1, limit: 20, totalPages: 1 };

describe('auditLog hooks', () => {
  beforeEach(() => {
    getAuditLogsMock.mockReset().mockResolvedValue(emptyPage);
    getAuditLogMetaMock.mockReset().mockResolvedValue({ actions: ['CREATE_MOVIE'], entityTypes: ['MOVIE'] });
  });

  it('useAuditLogs passes page, limit and filters through', async () => {
    const { result } = renderHook(() => useAuditLogs(2, 25, { branchId: 4, action: 'CANCEL_BOOKING' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAuditLogsMock).toHaveBeenCalledWith({ page: 2, limit: 25, branchId: 4, action: 'CANCEL_BOOKING' });
  });

  it('useAuditLogMeta loads the vocabulary', async () => {
    const { result } = renderHook(() => useAuditLogMeta(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.actions).toContain('CREATE_MOVIE');
  });
});
