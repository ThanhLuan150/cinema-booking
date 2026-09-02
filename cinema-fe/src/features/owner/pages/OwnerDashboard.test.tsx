import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerDashboardReducer from '../store/ownerDashboardSlice';
import realtimeReducer from '@/features/notifications/realtimeSlice';

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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const financialReportMock = vi.fn();
vi.mock('@/features/reporting/components/FinancialReport', () => ({
  FinancialReport: (props: Record<string, unknown>) => {
    financialReportMock(props);
    return <div data-testid="financial-report" />;
  },
}));

import OwnerDashboard from './OwnerDashboard';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerDashboard: ownerDashboardReducer, realtime: realtimeReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <OwnerDashboard />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('OwnerDashboard', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    financialReportMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('renders the branch-scoped financial report', () => {
    renderPage();
    expect(screen.getByTestId('financial-report')).toBeInTheDocument();
    expect(financialReportMock).toHaveBeenCalledWith({ variant: 'branch', branchId: '' });
  });

  it('scopes the report to the cinema selected from the dropdown', () => {
    renderPage();
    fireEvent.click(screen.getByText('dashboard.allMyCinemas'));
    fireEvent.click(screen.getByText('Cinema A'));
    expect(financialReportMock).toHaveBeenLastCalledWith({ variant: 'branch', branchId: '1' });
  });
});
