import apiClient from 'services/apiClient';
import type { FinancialReport, FinancialReportParams, OperationalReport } from '../types/reporting.types';

export const getFinancialReport = (params: FinancialReportParams = {}) =>
  apiClient.get<FinancialReport>('/reports/financial', { params }).then((res) => res.data);

export const getOperationalReport = (params: { branchId?: number | string } = {}) =>
  apiClient.get<OperationalReport>('/reports/operational', { params }).then((res) => res.data);
