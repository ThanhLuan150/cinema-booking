import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getFinancialReport } from '../api/reporting.api';
import type { FinancialReportParams } from '../types/reporting.types';

export const financialReportQueryKey = ['financialReport'] as const;

export function useFinancialReport(params: FinancialReportParams = {}) {
  const { branchId, from, to } = params;
  return useQuery({
    queryKey: [...financialReportQueryKey, branchId ?? 'all', from ?? null, to ?? null],
    queryFn: () => getFinancialReport({ branchId: branchId || undefined, from, to }),
    placeholderData: keepPreviousData,
  });
}
