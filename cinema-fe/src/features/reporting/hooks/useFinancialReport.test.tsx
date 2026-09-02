import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getFinancialReportMock = vi.fn();
vi.mock('../api/reporting.api', () => ({
  getFinancialReport: (...args: unknown[]) => getFinancialReportMock(...args),
}));

import { useFinancialReport } from './useFinancialReport';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useFinancialReport', () => {
  beforeEach(() => getFinancialReportMock.mockReset());

  it('fetches the financial report', async () => {
    getFinancialReportMock.mockResolvedValue({ scope: 'ALL', revenue: { netRevenue: 1000 } });
    const { result } = renderHook(() => useFinancialReport(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ scope: 'ALL', revenue: { netRevenue: 1000 } });
  });

  it('normalizes an empty branchId to undefined so the backend picks the caller\'s scope', async () => {
    getFinancialReportMock.mockResolvedValue({});
    const { result } = renderHook(() => useFinancialReport({ branchId: '' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getFinancialReportMock).toHaveBeenCalledWith({ branchId: undefined, from: undefined, to: undefined });
  });

  it('passes a selected branchId through', async () => {
    getFinancialReportMock.mockResolvedValue({});
    const { result } = renderHook(() => useFinancialReport({ branchId: '7' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getFinancialReportMock).toHaveBeenCalledWith({ branchId: '7', from: undefined, to: undefined });
  });
});
