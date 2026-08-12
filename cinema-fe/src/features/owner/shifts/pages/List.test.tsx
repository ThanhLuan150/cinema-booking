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

const useShiftsMock = vi.fn();
vi.mock('../../hooks/useShifts', () => ({
  useShifts: (...args: unknown[]) => useShiftsMock(...args),
}));

const createShiftMutate = vi.fn();
const updateShiftMutate = vi.fn();
const deleteShiftMutate = vi.fn();
vi.mock('../../hooks/useShiftMutations', () => ({
  useCreateShift: () => ({ mutateAsync: createShiftMutate, isPending: false }),
  useUpdateShift: () => ({ mutateAsync: updateShiftMutate, isPending: false }),
  useDeleteShift: () => ({ mutateAsync: deleteShiftMutate }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import ShiftList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerShifts: ownerShiftsReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ShiftList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Shifts List', () => {
  beforeEach(() => {
    useMyCinemasMock.mockReset();
    useShiftsMock.mockReset();
    createShiftMutate.mockReset();
    updateShiftMutate.mockReset();
    deleteShiftMutate.mockReset();
    confirmDialogMock.mockReset();
    hasPermissionMock.mockReset();
    hasPermissionMock.mockReturnValue(true);
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Cinema A' }] } });
  });

  it('renders shift rows with time range and status', () => {
    useShiftsMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'ACTIVE' }],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Morning')).toBeInTheDocument();
    expect(screen.getByText('08:00 - 16:00')).toBeInTheDocument();
    expect(screen.getByText('shifts.statusActive')).toBeInTheDocument();
  });

  it('deactivates a shift after confirming', async () => {
    useShiftsMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'ACTIVE' }],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    updateShiftMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('shifts.deactivate'));
    await waitFor(() => expect(updateShiftMutate).toHaveBeenCalledWith({ id: 1, status: 'INACTIVE' }));
  });

  it('reactivates an inactive shift without confirmation', async () => {
    useShiftsMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'INACTIVE' }],
        totalPages: 1,
      },
    });
    updateShiftMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('shifts.activate'));
    await waitFor(() => expect(updateShiftMutate).toHaveBeenCalledWith({ id: 1, status: 'ACTIVE' }));
  });

  it('deletes a shift after confirming', async () => {
    useShiftsMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'ACTIVE' }],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteShiftMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('shifts.delete'));
    await waitFor(() => expect(deleteShiftMutate).toHaveBeenCalledWith(1));
  });

  it('shows a toast error when deleting a shift with assignments fails', async () => {
    useShiftsMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'ACTIVE' }],
        totalPages: 1,
      },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteShiftMutate.mockRejectedValue({
      response: { data: { message: 'Shift has assignments and cannot be deleted', code: 'SHIFT_HAS_ASSIGNMENTS' } },
    });
    renderPage();
    fireEvent.click(screen.getByText('shifts.delete'));
    await waitFor(() => expect(deleteShiftMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-shift modal from the add button', () => {
    useShiftsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('shifts.addButton'));
    expect(screen.getByText('shifts.addTitle')).toBeInTheDocument();
  });

  it('opens the edit modal for a shift', () => {
    useShiftsMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'ACTIVE' }],
        totalPages: 1,
      },
    });
    renderPage();
    fireEvent.click(screen.getByText('shifts.edit'));
    expect(screen.getByText('shifts.editTitle')).toBeInTheDocument();
  });

  it('hides the add button when the caller lacks shift.create', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'shift.create');
    useShiftsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    expect(screen.queryByText('shifts.addButton')).not.toBeInTheDocument();
  });

  it('hides edit/deactivate/delete when the caller lacks shift.update and shift.delete', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'shift.update' && code !== 'shift.delete');
    useShiftsMock.mockReturnValue({
      data: {
        data: [{ id: 1, branch_id: 1, name: 'Morning', start_time: '08:00', end_time: '16:00', status: 'ACTIVE' }],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.queryByText('shifts.edit')).not.toBeInTheDocument();
    expect(screen.queryByText('shifts.deactivate')).not.toBeInTheDocument();
    expect(screen.queryByText('shifts.delete')).not.toBeInTheDocument();
  });
});
