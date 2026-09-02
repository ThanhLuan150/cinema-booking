export interface RevenueBreakdown {
  ticketRevenue: number;
  comboRevenue: number;
  discount: number;
  refund: number;
  netRevenue: number;
}

export interface ReportTotals {
  branchCount: number;
  employeeCount: number;
  movieCount: number | null;
  showtimeCount: number;
  bookingCount: number;
  ticketCount: number;
}

export interface RevenueByBranchRow {
  branchId: number;
  branchName: string;
  ticketRevenue: number;
  comboRevenue: number;
  discount: number;
  refund: number;
  netRevenue: number;
}

export interface TopMovieRow {
  movieId: number;
  name: string;
  ticketsSold: number;
  revenue: number;
}

export interface RefundStatusBucket {
  count: number;
  amount: number;
}

export interface RefundSummary {
  count: number;
  amount: number;
  byStatus: Record<string, RefundStatusBucket>;
}

export interface RevenueByDayRow {
  date: string;
  total: number;
}

export interface FinancialReport {
  scope: 'ALL' | 'BRANCH';
  branchIds: number[] | null;
  range: { from: string | null; to: string | null };
  totals: ReportTotals;
  revenue: RevenueBreakdown;
  revenueByBranch: RevenueByBranchRow[];
  topMovies: TopMovieRow[];
  refundSummary: RefundSummary;
  revenueByDay: RevenueByDayRow[];
}

export interface OperationalMetrics {
  showtimesToday?: number;
  ticketsIssuedToday?: number;
  ticketsCheckedInToday?: number;
  pendingComboOrders?: number;
  openMaintenance?: number;
}

export type OperationalMetricKey = keyof OperationalMetrics;

export interface OperationalReport {
  scope: 'ALL' | 'BRANCH';
  branchIds: number[] | null;
  positionCode: string | null;
  metrics: OperationalMetrics;
}

export interface FinancialReportParams {
  branchId?: number | string;
  from?: string;
  to?: string;
}
