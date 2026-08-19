import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import ownerEmployeesReducer from '../../store/ownerEmployeesSlice';
import { ROLES } from '@/constants/roles';

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
vi.mock('../../hooks/useMyCinemas', () => ({ useMyCinemas: () => useMyCinemasMock() }));

const useMyEmployeesMock = vi.fn();
vi.mock('../../hooks/useMyEmployees', () => ({ useMyEmployees: (...args: unknown[]) => useMyEmployeesMock(...args) }));

const usePositionsMock = vi.fn();
vi.mock('../../hooks/usePositions', () => ({ usePositions: () => usePositionsMock() }));

vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => true }) }));

vi.mock('../../hooks/useEmployeeMutations', () => ({
  useCreateEmployee: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateEmployee: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeactivateEmployee: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useResetEmployeePassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import EmployeeList from './List';

function renderPage(role: number) {
  const queryClient = new QueryClient();
  const store = configureStore({
    reducer: { auth: authReducer, ownerEmployees: ownerEmployeesReducer },
    preloadedState: { auth: { accessToken: 'token', userId: '1', role: String(role), account: null } },
  });
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

describe('owner Employees List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useMyEmployeesMock.mockReset();
    usePositionsMock.mockReset();
    usePositionsMock.mockReturnValue({ data: [] });
  });

  it('offers "All branches" and a Branch column for a super admin', () => {
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Branch A' }, { id: 2, name: 'Branch B' }] } });
    useMyEmployeesMock.mockReturnValue({
      data: {
        data: [
          { id: 1, branch_id: 1, employee_code: 'EMP-000001', name: 'Alice', email: 'a@b.com', status: 1 },
          { id: 2, branch_id: 2, employee_code: 'EMP-000002', name: 'Bob', email: 'b@b.com', status: 1 },
        ],
        totalPages: 1,
      },
    });
    renderPage(ROLES.admin);
    expect(screen.getByText('employees.headers.branch')).toBeInTheDocument();
    expect(screen.getByText('Branch A')).toBeInTheDocument();
    expect(screen.getByText('Branch B')).toBeInTheDocument();
    // The list hook should have been called with branchId=undefined once "All branches" resolves.
    expect(useMyEmployeesMock).toHaveBeenLastCalledWith(undefined, 1, expect.any(Number), { enabled: true });
  });

  it('does not offer "All branches" or a Branch column for a branch admin', () => {
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Branch A' }] } });
    useMyEmployeesMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, employee_code: 'EMP-000001', name: 'Alice', email: 'a@b.com', status: 1 }], totalPages: 1 },
    });
    renderPage(ROLES.owner);
    expect(screen.queryByText('employees.headers.branch')).not.toBeInTheDocument();
    expect(screen.queryByText('employees.allBranches')).not.toBeInTheDocument();
    expect(useMyEmployeesMock).toHaveBeenLastCalledWith('1', 1, expect.any(Number), { enabled: true });
  });
});
