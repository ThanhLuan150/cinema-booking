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
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ data: { role: 3, cinema_id: 5 } }),
}));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

const useMySchedulesMock = vi.fn();
vi.mock('../hooks/useMySchedules', () => ({ useMySchedules: (...args: unknown[]) => useMySchedulesMock(...args) }));

const useMoviesMock = vi.fn();
vi.mock('@/features/movies/hooks/useMovies', () => ({ useMovies: (...args: unknown[]) => useMoviesMock(...args) }));

const useScheduleSeatsMock = vi.fn();
vi.mock('../hooks/useScheduleSeats', () => ({
  useScheduleSeats: (...args: unknown[]) => useScheduleSeatsMock(...args),
}));

const createCounterSaleMutate = vi.fn();
vi.mock('../hooks/useCounterSale', () => ({
  useCreateCounterSale: () => ({ mutateAsync: createCounterSaleMutate, isPending: false }),
}));

const findAccountByEmailMock = vi.fn();
vi.mock('../api/employee.api', () => ({
  findAccountByEmail: (...args: unknown[]) => findAccountByEmailMock(...args),
}));

import CounterSale from './CounterSale';

function renderPage(initialPath = '/EmployeeCounterSale?scheduleId=1') {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { placeholder: () => ({}) } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter
          initialEntries={[initialPath]}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <CounterSale />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('CounterSale', () => {
  beforeEach(() => {
    useMySchedulesMock.mockReset();
    useMoviesMock.mockReset();
    useScheduleSeatsMock.mockReset();
    createCounterSaleMutate.mockReset();
    findAccountByEmailMock.mockReset();
    useMoviesMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Movie A' }] } });
    useMySchedulesMock.mockReturnValue({
      data: { data: [{ id: 1, movie_id: 1, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', price: 100000 }] },
    });
  });

  it('preselects the schedule from the scheduleId query param and shows its seats', () => {
    useScheduleSeatsMock.mockReturnValue({
      data: [
        { id: 10, seat_code: 'A1', seat_type: 0, status: 1 },
        { id: 11, seat_code: 'A2', seat_type: 0, status: 0 },
      ],
    });
    renderPage();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
  });

  it('toggles an available seat and updates the total price', () => {
    useScheduleSeatsMock.mockReturnValue({ data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 1 }] });
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    expect(screen.getByText(/counterSale.total/)).toHaveTextContent('100,000');
  });

  it('does not select an already-booked seat', () => {
    useScheduleSeatsMock.mockReturnValue({ data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 0 }] });
    renderPage();
    fireEvent.click(screen.getByText('A1'));
    expect(screen.getByText(/counterSale.total/)).toHaveTextContent('0');
  });

  it('looks up a customer by email', async () => {
    useScheduleSeatsMock.mockReturnValue({ data: [] });
    findAccountByEmailMock.mockResolvedValue({ id: 42, email: 'a@b.com' });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText('counterSale.customerEmailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.click(screen.getByText('counterSale.findCustomer'));
    await waitFor(() => expect(findAccountByEmailMock).toHaveBeenCalledWith('a@b.com'));
  });

  it('submits a counter sale with the resolved seats, customer and cinema', async () => {
    useScheduleSeatsMock.mockReturnValue({ data: [{ id: 10, seat_code: 'A1', seat_type: 0, status: 1 }] });
    findAccountByEmailMock.mockResolvedValue({ id: 42, email: 'a@b.com' });
    createCounterSaleMutate.mockResolvedValue({ id: 1 });
    renderPage();

    fireEvent.click(screen.getByText('A1'));
    fireEvent.change(screen.getByPlaceholderText('counterSale.customerEmailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.click(screen.getByText('counterSale.findCustomer'));
    await waitFor(() => expect(screen.getByText('counterSale.submit')).not.toBeDisabled());

    fireEvent.click(screen.getByText('counterSale.submit'));
    await waitFor(() =>
      expect(createCounterSaleMutate).toHaveBeenCalledWith({
        ticketIds: [10],
        comboIds: [],
        voucherCode: null,
        discountAmount: 0,
        totalPrice: 100000,
        accountId: 42,
        cinema_id: 5,
      }),
    );
  });
});
