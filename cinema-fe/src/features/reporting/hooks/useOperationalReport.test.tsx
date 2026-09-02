import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getOperationalReportMock = vi.fn();
vi.mock('../api/reporting.api', () => ({
  getOperationalReport: (...args: unknown[]) => getOperationalReportMock(...args),
}));

import { useOperationalReport } from './useOperationalReport';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOperationalReport', () => {
  beforeEach(() => getOperationalReportMock.mockReset());

  it('fetches the operational report', async () => {
    getOperationalReportMock.mockResolvedValue({ showtimesToday: 3 });
    const { result } = renderHook(() => useOperationalReport(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ showtimesToday: 3 });
    expect(getOperationalReportMock).toHaveBeenCalledWith({ branchId: undefined });
  });

  it('does not fetch when disabled', () => {
    renderHook(() => useOperationalReport(undefined, { enabled: false }), { wrapper });
    expect(getOperationalReportMock).not.toHaveBeenCalled();
  });
});
