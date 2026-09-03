import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) =>
        opts && 'time' in opts ? `${key}:${opts.time}` : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

const useCurrentUserMock = vi.fn();
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: (...args: unknown[]) => useCurrentUserMock(...args) }));

const useCashierShiftsMock = vi.fn();
vi.mock('../hooks/useCashierShifts', () => ({ useCashierShifts: (...args: unknown[]) => useCashierShiftsMock(...args) }));

const useCurrentCashierShiftMock = vi.fn();
vi.mock('../hooks/useCurrentCashierShift', () => ({
  useCurrentCashierShift: (...args: unknown[]) => useCurrentCashierShiftMock(...args),
}));

const openMutate = vi.fn();
vi.mock('../hooks/useOpenCashierShift', () => ({
  useOpenCashierShift: () => ({ mutateAsync: openMutate, isPending: false }),
}));

const closeMutate = vi.fn();
vi.mock('../hooks/useCloseCashierShift', () => ({
  useCloseCashierShift: () => ({ mutateAsync: closeMutate, isPending: false }),
}));

const useCashierShiftReconciliationMock = vi.fn();
vi.mock('../hooks/useCashierShiftReconciliation', () => ({
  useCashierShiftReconciliation: (...args: unknown[]) => useCashierShiftReconciliationMock(...args),
}));

import CashierShiftsPage from './CashierShiftsPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: (state = {}) => state });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CashierShiftsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('CashierShiftsPage', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset().mockReturnValue(true);
    useCurrentUserMock.mockReset().mockReturnValue({ data: { cinema_id: 1 } });
    useCashierShiftsMock.mockReset().mockReturnValue({ data: { data: [], totalPages: 1 }, isLoading: false });
    useCurrentCashierShiftMock.mockReset().mockReturnValue({ data: { shift: null, reconciliation: null }, isLoading: false });
    useCashierShiftReconciliationMock.mockReset().mockReturnValue({ data: undefined });
    openMutate.mockReset();
    closeMutate.mockReset();
  });

  it('offers to open a shift when the cashier has none open', () => {
    renderPage();
    expect(screen.getByText('currentShift.noShiftOpen')).toBeInTheDocument();
    expect(screen.getByText('currentShift.openButton')).toBeInTheDocument();
  });

  it('opens a shift using the caller’s own branch_id and the entered opening cash', async () => {
    openMutate.mockResolvedValue({ id: 1, status: 'OPEN' });
    renderPage();

    fireEvent.click(screen.getByText('currentShift.openButton'));
    fireEvent.change(screen.getByPlaceholderText('currentShift.openingCashPlaceholder'), { target: { value: '500000' } });
    fireEvent.click(screen.getByText('currentShift.openSubmit'));

    await waitFor(() =>
      expect(openMutate).toHaveBeenCalledWith({ branch_id: 1, opening_cash: 500000, note: undefined }),
    );
  });

  it('shows live reconciliation figures and a close button when a shift is open', () => {
    useCurrentCashierShiftMock.mockReturnValue({
      data: {
        shift: { id: 7, opened_at: '2026-01-01T08:00:00.000Z' },
        reconciliation: { openingCash: 500000, cashSales: 300000, cashRefunds: 0, expectedCash: 800000, live: true },
      },
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('800,000đ')).toBeInTheDocument();
    expect(screen.getByText('currentShift.closeButton')).toBeInTheDocument();
    expect(screen.queryByText('currentShift.noShiftOpen')).not.toBeInTheDocument();
  });

  it('closes the open shift with the counted actual cash', async () => {
    useCurrentCashierShiftMock.mockReturnValue({
      data: {
        shift: { id: 7, opened_at: '2026-01-01T08:00:00.000Z' },
        reconciliation: { openingCash: 500000, cashSales: 300000, cashRefunds: 0, expectedCash: 800000, live: true },
      },
      isLoading: false,
    });
    closeMutate.mockResolvedValue({ id: 7, status: 'CLOSED', difference: -10000 });
    renderPage();

    fireEvent.click(screen.getByText('currentShift.closeButton'));
    fireEvent.change(screen.getByPlaceholderText('currentShift.actualCashPlaceholder'), { target: { value: '790000' } });
    fireEvent.click(screen.getByText('currentShift.closeSubmit'));

    await waitFor(() =>
      expect(closeMutate).toHaveBeenCalledWith({ id: 7, payload: { actual_cash: 790000, note: undefined } }),
    );
  });

  it('does not show the drawer panel without cashierShift.open', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'cashierShift.open');
    renderPage();
    expect(screen.queryByText('currentShift.title')).not.toBeInTheDocument();
  });

  it('lists shifts and lets a scoped viewer close any open one', () => {
    useCashierShiftsMock.mockReturnValue({
      data: {
        data: [
          { id: 1, employee_id: 3, opened_at: '2026-01-01T08:00:00.000Z', closed_at: null, opening_cash: 500000, expected_cash: null, actual_cash: null, difference: null, status: 'OPEN' },
          { id: 2, employee_id: 4, opened_at: '2026-01-01T08:00:00.000Z', closed_at: '2026-01-01T16:00:00.000Z', opening_cash: 500000, expected_cash: 900000, actual_cash: 890000, difference: -10000, status: 'CLOSED' },
        ],
        totalPages: 1,
      },
      isLoading: false,
    });
    renderPage();

    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('#4')).toBeInTheDocument();
    // Only the OPEN row (id 1) gets an inline close action.
    expect(screen.getAllByText('currentShift.closeButton')).toHaveLength(1);
    expect(screen.getByText('-10,000đ')).toBeInTheDocument();
  });

  it('does not show the list without cashierShift.read', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'cashierShift.read');
    renderPage();
    expect(screen.queryByText('headers.id')).not.toBeInTheDocument();
  });
});
