import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { role: 3 } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const refetchMock = vi.fn();
const useLookupInvoiceForCheckInMock = vi.fn();
const checkInMutate = vi.fn();
vi.mock('../hooks/useInvoiceCheckIn', () => ({
  useLookupInvoiceForCheckIn: (...args: unknown[]) => useLookupInvoiceForCheckInMock(...args),
  useCheckInInvoice: () => ({ mutateAsync: checkInMutate, isPending: false }),
}));

import CheckIn from './CheckIn';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { placeholder: () => ({}) } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <CheckIn />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('CheckIn', () => {
  beforeEach(() => {
    refetchMock.mockReset();
    useLookupInvoiceForCheckInMock.mockReset();
    checkInMutate.mockReset();
    useLookupInvoiceForCheckInMock.mockReturnValue({ data: undefined, refetch: refetchMock, isFetching: false, error: null });
  });

  it('looks up an invoice by code', () => {
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('checkIn.codePlaceholder'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('checkIn.lookup'));
    expect(refetchMock).toHaveBeenCalled();
  });

  it('shows an error when the invoice is not found', () => {
    useLookupInvoiceForCheckInMock.mockReturnValue({
      data: undefined,
      refetch: refetchMock,
      isFetching: false,
      error: new Error('not found'),
    });
    renderPage();
    expect(screen.getByText('checkIn.notFound')).toBeInTheDocument();
  });

  it('shows the invoice detail and allows checking in a paid, not-yet-checked-in booking', async () => {
    useLookupInvoiceForCheckInMock.mockReturnValue({
      data: {
        id: 1,
        code: 'ABC',
        status: 1,
        checked_in: false,
        total_price: 100000,
        movie: { name: 'Movie A' },
        cinema: { name: 'Cinema A' },
        schedule: { movie_date: '2026-01-01', time_begin: '10:00' },
        ticket: { seat_code: 'A1', seat_type: 0, status: 0 },
      },
      refetch: refetchMock,
      isFetching: false,
      error: null,
    });
    checkInMutate.mockResolvedValue({});
    renderPage();

    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('checkIn.statusPaid')).toBeInTheDocument();

    fireEvent.click(screen.getByText('checkIn.confirmCheckIn'));
    await waitFor(() => expect(checkInMutate).toHaveBeenCalledWith(1));
  });

  it('disables check-in for an already checked-in booking', () => {
    useLookupInvoiceForCheckInMock.mockReturnValue({
      data: {
        id: 1,
        code: 'ABC',
        status: 1,
        checked_in: true,
        total_price: 100000,
        ticket: { seat_code: 'A1', seat_type: 0, status: 0 },
      },
      refetch: refetchMock,
      isFetching: false,
      error: null,
    });
    renderPage();
    expect(screen.getByText('checkIn.statusCheckedIn')).toBeInTheDocument();
    expect(screen.getByText('checkIn.confirmCheckIn')).toBeDisabled();
  });
});
