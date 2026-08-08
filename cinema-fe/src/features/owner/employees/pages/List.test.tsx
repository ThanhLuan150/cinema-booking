import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerEmployeesReducer from '../../store/ownerEmployeesSlice';

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

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({
  useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args),
}));

const useMyEmployeesMock = vi.fn();
vi.mock('../../hooks/useMyEmployees', () => ({
  useMyEmployees: (...args: unknown[]) => useMyEmployeesMock(...args),
}));

const createEmployeeMutate = vi.fn();
const updateEmployeeMutate = vi.fn();
const deactivateEmployeeMutate = vi.fn();
vi.mock('../../hooks/useEmployeeMutations', () => ({
  useCreateEmployee: () => ({ mutateAsync: createEmployeeMutate, isPending: false }),
  useUpdateEmployee: () => ({ mutateAsync: updateEmployeeMutate }),
  useDeactivateEmployee: () => ({ mutateAsync: deactivateEmployeeMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import EmployeeList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerEmployees: ownerEmployeesReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <EmployeeList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Employees List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useMyEmployeesMock.mockReset();
    createEmployeeMutate.mockReset();
    updateEmployeeMutate.mockReset();
    deactivateEmployeeMutate.mockReset();
    confirmDialogMock.mockReset();
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('renders employee rows with status', () => {
    useMyEmployeesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Staff A', email: 'a@b.com', position: 'Cashier', status: 1 }], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('Staff A')).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.getByText('employees.statusActive')).toBeInTheDocument();
  });

  it('deactivates an employee after confirming', async () => {
    useMyEmployeesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Staff A', email: 'a@b.com', position: 'Cashier', status: 1 }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    deactivateEmployeeMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('employees.deactivate'));
    await waitFor(() => expect(deactivateEmployeeMutate).toHaveBeenCalledWith(1));
  });

  it('reactivates a deactivated employee', async () => {
    useMyEmployeesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Staff A', email: 'a@b.com', position: 'Cashier', status: 0 }], totalPages: 1 },
    });
    updateEmployeeMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('employees.reactivate'));
    await waitFor(() => expect(updateEmployeeMutate).toHaveBeenCalledWith({ id: 1, status: 1 }));
  });

  it('opens the add-employee modal from the add button', () => {
    useMyEmployeesMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('employees.addButton'));
    expect(screen.getByText('employees.addTitle')).toBeInTheDocument();
  });
});
