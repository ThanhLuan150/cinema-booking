import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { FinancialReport as FinancialReportData } from '../types/reporting.types';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 300 }}>{children}</div>
    ),
  };
});

const useFinancialReportMock = vi.fn();
vi.mock('../hooks/useFinancialReport', () => ({
  useFinancialReport: (...args: unknown[]) => useFinancialReportMock(...args),
  financialReportQueryKey: ['financialReport'],
}));

import { FinancialReport } from './FinancialReport';

const report: FinancialReportData = {
  scope: 'ALL',
  branchIds: null,
  range: { from: null, to: null },
  totals: {
    branchCount: 3,
    employeeCount: 12,
    movieCount: 8,
    showtimeCount: 40,
    bookingCount: 25,
    ticketCount: 60,
  },
  revenue: {
    ticketRevenue: 1000000,
    comboRevenue: 200000,
    discount: 50000,
    refund: 30000,
    netRevenue: 1120000,
  },
  revenueByBranch: [
    { branchId: 1, branchName: 'Branch One', ticketRevenue: 700000, comboRevenue: 100000, discount: 0, refund: 0, netRevenue: 800000 },
    { branchId: 2, branchName: 'Branch Two', ticketRevenue: 300000, comboRevenue: 100000, discount: 50000, refund: 30000, netRevenue: 320000 },
  ],
  topMovies: [
    { movieId: 1, name: 'Alpha', ticketsSold: 40, revenue: 700000 },
    { movieId: 2, name: 'Beta', ticketsSold: 20, revenue: 300000 },
  ],
  refundSummary: {
    count: 1,
    amount: 30000,
    byStatus: {
      REQUESTED: { count: 2, amount: 50000 },
      APPROVED: { count: 0, amount: 0 },
      REJECTED: { count: 0, amount: 0 },
      PROCESSING: { count: 0, amount: 0 },
      COMPLETED: { count: 1, amount: 30000 },
      FAILED: { count: 0, amount: 0 },
    },
  },
  revenueByDay: [
    { date: '2026-01-01', total: 1150000 },
    { date: '2026-01-02', total: -30000 },
  ],
};

describe('FinancialReport', () => {
  beforeEach(() => useFinancialReportMock.mockReset());

  it('shows a loading screen on the first visit, before any data is available', () => {
    useFinancialReportMock.mockReturnValue({ data: undefined, isLoading: true, isFetching: true });
    render(<FinancialReport variant="system" />);
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // the spinner
    // the report itself isn't rendered yet
    expect(screen.queryByText('stats.branches')).not.toBeInTheDocument();
    expect(screen.queryByText('breakdown.title')).not.toBeInTheDocument();
  });

  it('keeps the data on screen with an "updating" indicator during a background refresh', () => {
    useFinancialReportMock.mockReturnValue({ data: report, isLoading: false, isFetching: true });
    render(<FinancialReport variant="system" />);
    expect(screen.getByText('updating')).toBeInTheDocument();
    // ...and the real numbers are still visible, not a spinner screen
    expect(screen.getByText('stats.branches')).toBeInTheDocument();
    expect(screen.queryByText('loading')).not.toBeInTheDocument();
  });

  it('surfaces a permission error with guidance instead of a bare empty state', () => {
    useFinancialReportMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { isAxiosError: true, response: { status: 403 } },
      refetch: vi.fn(),
    });
    render(<FinancialReport variant="system" />);
    expect(screen.getByText('error.forbidden')).toBeInTheDocument();
    expect(screen.getByText('error.retry')).toBeInTheDocument();
    // ...and the page shell is still there.
    expect(screen.getByText('stats.branches')).toBeInTheDocument();
  });

  it('shows the generic error for a non-permission failure', () => {
    useFinancialReportMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { isAxiosError: true, response: { status: 500 } },
      refetch: vi.fn(),
    });
    render(<FinancialReport variant="system" />);
    expect(screen.getByText('error.generic')).toBeInTheDocument();
    expect(screen.queryByText('error.forbidden')).not.toBeInTheDocument();
  });

  it('renders the system stat tiles including branch and movie totals', () => {
    useFinancialReportMock.mockReturnValue({ data: report, isLoading: false });
    render(<FinancialReport variant="system" />);
    expect(screen.getByText('stats.branches')).toBeInTheDocument();
    expect(screen.getByText('stats.movies')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // branchCount
    expect(screen.getByText('8')).toBeInTheDocument(); // movieCount
  });

  it('renders the revenue breakdown ending in the net revenue', () => {
    useFinancialReportMock.mockReturnValue({ data: report, isLoading: false });
    render(<FinancialReport variant="system" />);
    expect(screen.getByText('breakdown.ticketRevenue')).toBeInTheDocument();
    expect(screen.getByText('breakdown.comboRevenue')).toBeInTheDocument();
    expect(screen.getByText('breakdown.discount')).toBeInTheDocument();
    expect(screen.getByText('breakdown.refund')).toBeInTheDocument();
    // 1,000,000 + 200,000 - 50,000 - 30,000 = 1,120,000, rendered on the tile and the row
    expect(screen.getAllByText('1,120,000đ').length).toBeGreaterThanOrEqual(2);
  });

  it('renders top movies and the refund summary', () => {
    useFinancialReportMock.mockReturnValue({ data: report, isLoading: false });
    render(<FinancialReport variant="system" />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    // the refund appears twice: as the breakdown's subtracted line and as the summary total
    expect(screen.getAllByText('−30,000đ')).toHaveLength(2);
    // only non-empty status buckets are listed
    expect(screen.getByText('refunds.status.REQUESTED')).toBeInTheDocument();
    expect(screen.queryByText('refunds.status.FAILED')).not.toBeInTheDocument();
  });

  it('hides branch-level totals and the by-branch chart for a single-branch report', () => {
    useFinancialReportMock.mockReturnValue({
      data: {
        ...report,
        scope: 'BRANCH',
        branchIds: [1],
        totals: { ...report.totals, movieCount: null },
        revenueByBranch: [report.revenueByBranch[0]],
      },
      isLoading: false,
    });
    render(<FinancialReport variant="branch" branchId="1" />);
    expect(screen.queryByText('stats.branches')).not.toBeInTheDocument();
    expect(screen.queryByText('stats.movies')).not.toBeInTheDocument();
    expect(screen.queryByText('byBranch.title')).not.toBeInTheDocument();
  });

  it('requests the report for the selected branch over an unbounded range by default', () => {
    useFinancialReportMock.mockReturnValue({ data: report, isLoading: false });
    render(<FinancialReport variant="branch" branchId="5" />);
    expect(useFinancialReportMock).toHaveBeenCalledWith({ branchId: '5', from: undefined, to: undefined });
  });

  it('re-requests the report when a day is picked from the calendar, and clears it with reset', () => {
    useFinancialReportMock.mockReturnValue({ data: report, isLoading: false });
    render(<FinancialReport variant="system" />);

    // DateInput opens a calendar dialog; day 15 exists in every month.
    fireEvent.click(screen.getByLabelText('range.from'));
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));

    const afterPick = useFinancialReportMock.mock.calls.at(-1)![0];
    expect(afterPick.from).toMatch(/^\d{4}-\d{2}-15$/);
    expect(afterPick.branchId).toBeUndefined();

    fireEvent.click(screen.getByText('range.reset'));
    expect(useFinancialReportMock.mock.calls.at(-1)![0]).toMatchObject({ from: undefined, to: undefined });
  });

  it('keeps the range picker and the card shells visible when there is no data', () => {
    useFinancialReportMock.mockReturnValue({ data: undefined, isLoading: false });
    render(<FinancialReport variant="system" />);
    expect(screen.getByLabelText('range.from')).toBeInTheDocument();
    // charts + refund card fall back to their empty states
    expect(screen.getAllByText('noData').length).toBeGreaterThanOrEqual(3);
  });

  it('shows empty states when there is nothing to chart', () => {
    useFinancialReportMock.mockReturnValue({
      data: { ...report, revenueByBranch: [], topMovies: [], revenueByDay: [] },
      isLoading: false,
    });
    render(<FinancialReport variant="system" />);
    expect(screen.getAllByText('noData').length).toBeGreaterThanOrEqual(3);
  });
});
