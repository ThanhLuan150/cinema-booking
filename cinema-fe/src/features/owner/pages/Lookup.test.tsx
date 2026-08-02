import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import realtimeReducer from '@/features/notifications/realtimeSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) =>
        key === 'bookingsLookup.statusLabels' && opts?.returnObjects
          ? ['Pending', 'Paid', 'Cancelled']
          : key === 'bookingsLookup.seatTypeLabels' && opts?.returnObjects
            ? ['Standard', 'Vip', 'Couple']
            : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const lookupMutate = vi.fn();
const lookupReset = vi.fn();
const useLookupInvoiceMock = vi.fn();
vi.mock('../hooks/useLookupInvoice', () => ({ useLookupInvoice: () => useLookupInvoiceMock() }));

import BookingLookup from './Lookup';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { realtime: realtimeReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <BookingLookup />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Booking Lookup', () => {
  beforeEach(() => {
    lookupMutate.mockReset();
    lookupReset.mockReset();
    useLookupInvoiceMock.mockReset();
    useLookupInvoiceMock.mockReturnValue({
      mutate: lookupMutate,
      reset: lookupReset,
      data: undefined,
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it('submits the trimmed, upper-cased ticket code', async () => {
    const { container } = renderPage();
    fireEvent.change(container.querySelector('input[name="code"]')!, { target: { value: ' abc123 ' } });
    fireEvent.click(screen.getByText('bookingsLookup.searchButton'));
    await waitFor(() => expect(lookupReset).toHaveBeenCalled());
    expect(lookupMutate).toHaveBeenCalledWith('ABC123');
  });

  it('renders the invoice details on success', () => {
    useLookupInvoiceMock.mockReturnValue({
      mutate: lookupMutate,
      reset: lookupReset,
      isPending: false,
      isError: false,
      error: null,
      data: {
        code: 'ABC123',
        movie: { name: 'Movie A' },
        cinema: { name: 'Cinema A' },
        schedule: { movie_date: '2026-08-01', time_begin: '18:00' },
        ticket: { seat_code: 'A1', seat_type: 0 },
        status: 1,
        total_price: 100000,
      },
    });
    renderPage();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText(/A1/)).toBeInTheDocument();
  });

  it('renders an error message when the lookup fails', () => {
    useLookupInvoiceMock.mockReturnValue({
      mutate: lookupMutate,
      reset: lookupReset,
      isPending: false,
      isError: true,
      error: { response: { data: { message: 'Not found' } } },
      data: undefined,
    });
    renderPage();
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });
});
