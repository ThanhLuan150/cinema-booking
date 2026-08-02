import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      t: (key: string, opts?: any) =>
        key === 'transactions.headers' && opts?.returnObjects
          ? ['ID', 'Code', 'Email', 'Movie', 'Seat', 'Total', 'Status', 'Actions']
          : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useAdminInvoicesMock = vi.fn();
vi.mock('../hooks/useAdminInvoices', () => ({ useAdminInvoices: (...args: unknown[]) => useAdminInvoicesMock(...args) }));

const refundMutate = vi.fn();
vi.mock('../hooks/useRefundInvoice', () => ({ useRefundInvoice: () => ({ mutateAsync: refundMutate }) }));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import AdminTransactionsList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminTransactionsList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Admin Transactions List', () => {
  beforeEach(() => {
    useAdminInvoicesMock.mockReset();
    refundMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders an invoice row with a refund button for booked invoices', () => {
    useAdminInvoicesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            code: 'ABC123',
            account: { email: 'a@b.com' },
            movie: { name: 'Movie A' },
            ticket: { seat_code: 'A1' },
            total_price: 100000,
            status: 1,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('ABC123')).toBeInTheDocument();
    expect(screen.getByText('transactions.refundButton')).toBeInTheDocument();
  });

  it('refunds an invoice after confirming', async () => {
    useAdminInvoicesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            code: 'ABC123',
            account: { email: 'a@b.com' },
            movie: { name: 'Movie A' },
            ticket: { seat_code: 'A1' },
            total_price: 100000,
            status: 1,
          },
        ],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    refundMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('transactions.refundButton'));
    await vi.waitFor(() => expect(refundMutate).toHaveBeenCalledWith(1));
  });
});
