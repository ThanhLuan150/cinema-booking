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
        key === 'bookingManagement.headers' && opts?.returnObjects
          ? ['ID', 'Code', 'Customer', 'Movie', 'Seats', 'Total', 'Status', 'Actions']
          : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useBookingsMock = vi.fn();
vi.mock('../hooks/useBookings', () => ({ useBookings: (...args: unknown[]) => useBookingsMock(...args) }));

const cancelMutate = vi.fn();
vi.mock('../hooks/useCancelBooking', () => ({ useCancelBooking: () => ({ mutateAsync: cancelMutate }) }));

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import BookingManagementPage from './BookingManagementPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <BookingManagementPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    code: 'BK-1',
    status: 'PAID',
    total_price: 100000,
    account: { email: 'a@b.com' },
    movie: { name: 'Movie A' },
    tickets: [{ id: 1, seat_code: 'A1', seat_type: 0 }],
    ...overrides,
  };
}

describe('BookingManagementPage', () => {
  beforeEach(() => {
    useBookingsMock.mockReset();
    cancelMutate.mockReset();
    hasPermissionMock.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders a scoped booking row (whatever the server returned) without a cancel button when the caller lacks booking.cancel', () => {
    hasPermissionMock.mockReturnValue(false);
    useBookingsMock.mockReturnValue({ data: { data: [booking()], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('BK-1')).toBeInTheDocument();
    expect(screen.getByText('Movie A')).toBeInTheDocument();
    expect(screen.queryByText('bookingManagement.cancel')).not.toBeInTheDocument();
  });

  it('shows and wires the cancel action when the caller has booking.cancel', async () => {
    hasPermissionMock.mockReturnValue(true);
    useBookingsMock.mockReturnValue({ data: { data: [booking()], totalPages: 1 } });
    confirmDialogMock.mockResolvedValue(true);
    cancelMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('bookingManagement.cancel'));
    await vi.waitFor(() => expect(cancelMutate).toHaveBeenCalledWith(1));
  });

  it('hides the cancel action for a booking that is no longer cancellable, even with permission', () => {
    hasPermissionMock.mockReturnValue(true);
    useBookingsMock.mockReturnValue({ data: { data: [booking({ status: 'COMPLETED' })], totalPages: 1 } });
    renderPage();
    expect(screen.queryByText('bookingManagement.cancel')).not.toBeInTheDocument();
  });
});
