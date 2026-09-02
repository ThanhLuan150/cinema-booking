import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

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

const useOperationalReportMock = vi.fn();
vi.mock('../hooks/useOperationalReport', () => ({
  useOperationalReport: (...args: unknown[]) => useOperationalReportMock(...args),
  operationalReportQueryKey: ['operationalReport'],
}));

import { OperationalSummary } from './OperationalSummary';

const report = (metrics: Record<string, number>, positionCode: string | null = null) => ({
  data: { scope: 'BRANCH', branchIds: [1], positionCode, metrics },
});

describe('OperationalSummary', () => {
  beforeEach(() => useOperationalReportMock.mockReset());

  it('renders nothing while the report is unavailable', () => {
    useOperationalReportMock.mockReturnValue({ data: undefined });
    const { container } = render(<OperationalSummary />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the full strip for a caller holding every operational permission', () => {
    useOperationalReportMock.mockReturnValue(
      report({
        showtimesToday: 4,
        ticketsIssuedToday: 30,
        ticketsCheckedInToday: 12,
        pendingComboOrders: 3,
        openMaintenance: 1,
      }),
    );
    render(<OperationalSummary />);
    expect(screen.getByText('operational.showtimesToday')).toBeInTheDocument();
    expect(screen.getByText('operational.ticketsCheckedInToday')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('renders only the metrics a Ticket Checker receives', () => {
    useOperationalReportMock.mockReturnValue(
      report({ ticketsIssuedToday: 30, ticketsCheckedInToday: 12, openMaintenance: 1 }, 'TICKET_CHECKER'),
    );
    render(<OperationalSummary />);
    expect(screen.getByText('operational.ticketsCheckedInToday')).toBeInTheDocument();
    expect(screen.queryByText('operational.pendingComboOrders')).not.toBeInTheDocument();
    expect(screen.queryByText('operational.showtimesToday')).not.toBeInTheDocument();
  });

  it('renders only the combo queue for Combo Staff', () => {
    useOperationalReportMock.mockReturnValue(
      report({ pendingComboOrders: 3, openMaintenance: 0 }, 'COMBO_STAFF'),
    );
    render(<OperationalSummary />);
    expect(screen.getByText('operational.pendingComboOrders')).toBeInTheDocument();
    expect(screen.queryByText('operational.ticketsIssuedToday')).not.toBeInTheDocument();
  });

  it('distinguishes a permitted zero from an omitted metric', () => {
    useOperationalReportMock.mockReturnValue(report({ openMaintenance: 0 }, 'SECURITY'));
    render(<OperationalSummary />);
    expect(screen.getByText('operational.openMaintenance')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('operational.showtimesToday')).not.toBeInTheDocument();
  });

  it('renders nothing when the Position justifies no metric at all', () => {
    useOperationalReportMock.mockReturnValue(report({}, 'CLEANING_STAFF'));
    const { container } = render(<OperationalSummary />);
    expect(container).toBeEmptyDOMElement();
  });

  it('never shows a money figure', () => {
    useOperationalReportMock.mockReturnValue(report({ showtimesToday: 4, openMaintenance: 1 }));
    render(<OperationalSummary />);
    expect(screen.queryByText('stats.netRevenue')).not.toBeInTheDocument();
    expect(screen.queryByText(/đ$/)).not.toBeInTheDocument();
  });
});
