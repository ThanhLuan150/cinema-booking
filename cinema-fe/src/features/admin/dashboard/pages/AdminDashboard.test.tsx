import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

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

const financialReportMock = vi.fn();
vi.mock('@/features/reporting/components/FinancialReport', () => ({
  FinancialReport: (props: Record<string, unknown>) => {
    financialReportMock(props);
    return <div data-testid="financial-report" />;
  },
}));

import AdminDashboard from './AdminDashboard';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminDashboard />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('AdminDashboard', () => {
  it('renders the system-wide financial report', () => {
    renderPage();
    expect(screen.getByTestId('financial-report')).toBeInTheDocument();
    expect(financialReportMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'system' }));
  });

  it('does not scope the report to a branch', () => {
    renderPage();
    expect(financialReportMock).not.toHaveBeenCalledWith(expect.objectContaining({ branchId: expect.anything() }));
  });
});
