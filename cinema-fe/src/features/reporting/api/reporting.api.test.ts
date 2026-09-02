import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
vi.mock('services/apiClient', () => ({ default: { get: (...args: unknown[]) => getMock(...args) } }));

import { getFinancialReport, getOperationalReport } from './reporting.api';

describe('reporting.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getFinancialReport gets /reports/financial with no params by default', async () => {
    await getFinancialReport();
    expect(getMock).toHaveBeenCalledWith('/reports/financial', { params: {} });
  });

  it('getFinancialReport passes branchId and the date range through', async () => {
    await getFinancialReport({ branchId: 3, from: '2026-01-01', to: '2026-01-31' });
    expect(getMock).toHaveBeenCalledWith('/reports/financial', {
      params: { branchId: 3, from: '2026-01-01', to: '2026-01-31' },
    });
  });

  it('getOperationalReport gets /reports/operational', async () => {
    await getOperationalReport({ branchId: 2 });
    expect(getMock).toHaveBeenCalledWith('/reports/operational', { params: { branchId: 2 } });
  });
});
