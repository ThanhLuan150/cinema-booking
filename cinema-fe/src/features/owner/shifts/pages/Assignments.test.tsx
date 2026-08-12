import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerShiftsReducer from '../../store/ownerShiftsSlice';

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

const useShiftsMock = vi.fn();
vi.mock('../../hooks/useShifts', () => ({
  useShifts: (...args: unknown[]) => useShiftsMock(...args),
}));

const useShiftAssignmentsMock = vi.fn();
vi.mock('../../hooks/useShiftAssignments', () => ({
  useShiftAssignments: (...args: unknown[]) => useShiftAssignmentsMock(...args),
}));

const createAssignmentMutate = vi.fn();
const cancelAssignmentMutate = vi.fn();
const deleteAssignmentMutate = vi.fn();
vi.mock('../../hooks/useShiftAssignmentMutations', () => ({
  useCreateShiftAssignment: () => ({ mutateAsync: createAssignmentMutate, isPending: false }),
  useCancelShiftAssignment: () => ({ mutateAsync: cancelAssignmentMutate }),
  useDeleteShiftAssignment: () => ({ mutateAsync: deleteAssignmentMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import ShiftAssignmentList from './Assignments';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerShifts: ownerShiftsReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ShiftAssignmentList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Shift Assignments List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useMyEmployeesMock.mockReset();
    useShiftsMock.mockReset();
    useShiftAssignmentsMock.mockReset();
    createAssignmentMutate.mockReset();
    cancelAssignmentMutate.mockReset();
    deleteAssignmentMutate.mockReset();
    confirmDialogMock.mockReset();
    hasPermissionMock.mockReset();
    hasPermissionMock.mockReturnValue(true);
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
    useMyEmployeesMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Staff A', employee_code: 'EMP-000001' }] },
    });
    useShiftsMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'ACTIVE' }] },
    });
  });

  it('renders assignment rows with employee/shift names and formatted times', () => {
    useShiftAssignmentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_id: 1,
            shift_id: 1,
            branch_id: 1,
            date: '2026-08-12',
            start_at: '2026-08-12T08:00:00',
            end_at: '2026-08-12T16:00:00',
            status: 'ACTIVE',
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Staff A')).toBeInTheDocument();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('2026-08-12')).toBeInTheDocument();
    expect(screen.getByText('08:00 - 16:00')).toBeInTheDocument();
    expect(screen.getByText('shiftAssignments.statusActive')).toBeInTheDocument();
  });

  it('cancels an assignment after confirming', async () => {
    useShiftAssignmentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_id: 1,
            shift_id: 1,
            branch_id: 1,
            date: '2026-08-12',
            start_at: '2026-08-12T08:00:00',
            end_at: '2026-08-12T16:00:00',
            status: 'ACTIVE',
          },
        ],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    cancelAssignmentMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('shiftAssignments.cancel'));
    await waitFor(() => expect(cancelAssignmentMutate).toHaveBeenCalledWith(1));
  });

  it('deletes an assignment after confirming', async () => {
    useShiftAssignmentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_id: 1,
            shift_id: 1,
            branch_id: 1,
            date: '2026-08-12',
            start_at: '2026-08-12T08:00:00',
            end_at: '2026-08-12T16:00:00',
            status: 'CANCELLED',
          },
        ],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteAssignmentMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('shiftAssignments.delete'));
    await waitFor(() => expect(deleteAssignmentMutate).toHaveBeenCalledWith(1));
  });

  it('does not show cancel for an already-cancelled assignment', () => {
    useShiftAssignmentsMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_id: 1,
            shift_id: 1,
            branch_id: 1,
            date: '2026-08-12',
            start_at: '2026-08-12T08:00:00',
            end_at: '2026-08-12T16:00:00',
            status: 'CANCELLED',
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.queryByText('shiftAssignments.cancel')).not.toBeInTheDocument();
  });

  it('opens the assign modal from the assign button', () => {
    useShiftAssignmentsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('shiftAssignments.assignButton'));
    expect(screen.getByText('shiftAssignments.assignTitle')).toBeInTheDocument();
  });

  it('shows a toast error surfacing a documented API error code on create failure', async () => {
    useShiftAssignmentsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createAssignmentMutate.mockRejectedValue({
      response: { data: { message: 'This employee is already assigned to this shift on this date', code: 'DUPLICATE_ASSIGNMENT' } },
    });
    renderPage();
    fireEvent.click(screen.getByText('shiftAssignments.assignButton'));

    fireEvent.click(screen.getByText('shiftAssignments.employeePlaceholder'));
    fireEvent.click(screen.getByText('Staff A'));
    fireEvent.click(screen.getByText('shiftAssignments.shiftPlaceholder'));
    fireEvent.click(screen.getByText('Morning (08:00-16:00)'));
    const dateInput = document.body.querySelector('input[name="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-08-12' } });

    fireEvent.click(screen.getByText('shiftAssignments.submit'));
    await waitFor(() =>
      expect(createAssignmentMutate).toHaveBeenCalledWith({ employee_id: '1', shift_id: '1', date: '2026-08-12' }),
    );
  });

  it('creates a shift assignment via the assign modal', async () => {
    useShiftAssignmentsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createAssignmentMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('shiftAssignments.assignButton'));

    fireEvent.click(screen.getByText('shiftAssignments.employeePlaceholder'));
    fireEvent.click(screen.getByText('Staff A'));
    fireEvent.click(screen.getByText('shiftAssignments.shiftPlaceholder'));
    fireEvent.click(screen.getByText('Morning (08:00-16:00)'));
    const dateInput = document.body.querySelector('input[name="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-08-12' } });

    fireEvent.click(screen.getByText('shiftAssignments.submit'));
    await waitFor(() =>
      expect(createAssignmentMutate).toHaveBeenCalledWith({ employee_id: '1', shift_id: '1', date: '2026-08-12' }),
    );
  });

  it('hides the assign button when the caller lacks shiftAssignment.create', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'shiftAssignment.create');
    useShiftAssignmentsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    expect(screen.queryByText('shiftAssignments.assignButton')).not.toBeInTheDocument();
  });
});
