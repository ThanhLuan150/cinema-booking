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
const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

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
const resetPasswordMutate = vi.fn();
vi.mock('../../hooks/useEmployeeMutations', () => ({
  useCreateEmployee: () => ({ mutateAsync: createEmployeeMutate, isPending: false }),
  useUpdateEmployee: () => ({ mutateAsync: updateEmployeeMutate }),
  useDeactivateEmployee: () => ({ mutateAsync: deactivateEmployeeMutate }),
  useResetEmployeePassword: () => ({ mutateAsync: resetPasswordMutate }),
}));

const usePositionsMock = vi.fn();
vi.mock('../../hooks/usePositions', () => ({
  usePositions: (...args: unknown[]) => usePositionsMock(...args),
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
    resetPasswordMutate.mockReset();
    confirmDialogMock.mockReset();
    hasPermissionMock.mockReset();
    hasPermissionMock.mockReturnValue(true);
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    usePositionsMock.mockReturnValue({ data: [{ id: 1, code: 'CASHIER', name: 'Cashier' }] });
  });

  it('renders employee rows with status', () => {
    useMyEmployeesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_code: 'EMP-000001',
            name: 'Staff A',
            email: 'a@b.com',
            position: { code: 'CASHIER', name: 'Cashier' },
            status: 1,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Staff A')).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.getByText('EMP-000001')).toBeInTheDocument();
    expect(screen.getByText('Cashier')).toBeInTheDocument();
    expect(screen.getByText('employees.statusActive')).toBeInTheDocument();
  });

  it('deactivates an employee after confirming', async () => {
    useMyEmployeesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_code: 'EMP-000001',
            name: 'Staff A',
            email: 'a@b.com',
            position: { code: 'CASHIER', name: 'Cashier' },
            status: 1,
          },
        ],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    deactivateEmployeeMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('employees.deactivate'));
    await waitFor(() => expect(deactivateEmployeeMutate).toHaveBeenCalledWith(1));
  });

  it('reactivates a deactivated employee', async () => {
    useMyEmployeesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_code: 'EMP-000001',
            name: 'Staff A',
            email: 'a@b.com',
            position: { code: 'CASHIER', name: 'Cashier' },
            status: 0,
          },
        ],
        totalPages: 1,
      },
    });
    updateEmployeeMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('employees.reactivate'));
    await waitFor(() => expect(updateEmployeeMutate).toHaveBeenCalledWith({ id: 1, status: 1 }));
  });

  it('resets an employee password after confirming', async () => {
    useMyEmployeesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_code: 'EMP-000001',
            name: 'Staff A',
            email: 'a@b.com',
            position: { code: 'CASHIER', name: 'Cashier' },
            status: 1,
          },
        ],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    resetPasswordMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('employees.resetPassword'));
    await waitFor(() => expect(resetPasswordMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-employee modal from the add button', () => {
    useMyEmployeesMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('employees.addButton'));
    expect(screen.getByText('employees.addTitle')).toBeInTheDocument();
  });

  it('hides the add button when the caller lacks employee.create', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'employee.create');
    useMyEmployeesMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    expect(screen.queryByText('employees.addButton')).not.toBeInTheDocument();
  });

  it('hides deactivate/reset-password when the caller lacks employee.delete and employee.update', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'employee.delete' && code !== 'employee.update');
    useMyEmployeesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_code: 'EMP-000001',
            name: 'Staff A',
            email: 'a@b.com',
            position: { code: 'CASHIER', name: 'Cashier' },
            status: 1,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.queryByText('employees.deactivate')).not.toBeInTheDocument();
    expect(screen.queryByText('employees.resetPassword')).not.toBeInTheDocument();
  });

  it('hides reactivate when the caller lacks employee.update', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'employee.update');
    useMyEmployeesMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_code: 'EMP-000001',
            name: 'Staff A',
            email: 'a@b.com',
            position: { code: 'CASHIER', name: 'Cashier' },
            status: 0,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.queryByText('employees.reactivate')).not.toBeInTheDocument();
  });
});
