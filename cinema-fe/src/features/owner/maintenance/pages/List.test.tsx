import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import ownerMaintenanceReducer from '../../store/ownerMaintenanceSlice';
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

const useAuthRoleMock = vi.fn();
vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => useAuthRoleMock() }));

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: (code: string) => hasPermissionMock(code) }) }));

const useMyCinemasMock = vi.fn();
vi.mock('../../hooks/useMyCinemas', () => ({ useMyCinemas: (...args: unknown[]) => useMyCinemasMock(...args) }));

const useMyEmployeesMock = vi.fn();
vi.mock('../../hooks/useMyEmployees', () => ({ useMyEmployees: (...args: unknown[]) => useMyEmployeesMock(...args) }));

const useRoomsByCinemaMock = vi.fn();
vi.mock('../../hooks/useRoomsByCinema', () => ({ useRoomsByCinema: (...args: unknown[]) => useRoomsByCinemaMock(...args) }));

const useSeatsByRoomMock = vi.fn();
vi.mock('../../hooks/useSeatsByRoom', () => ({ useSeatsByRoom: (...args: unknown[]) => useSeatsByRoomMock(...args) }));

const useOwnerMaintenanceMock = vi.fn();
vi.mock('../../hooks/useOwnerMaintenance', () => ({ useOwnerMaintenance: (...args: unknown[]) => useOwnerMaintenanceMock(...args) }));

const createMutate = vi.fn();
const assignMutate = vi.fn();
const startMutate = vi.fn();
const resolveMutate = vi.fn();
const closeMutate = vi.fn();
const deleteMutate = vi.fn();
vi.mock('../../hooks/useMaintenanceMutations', () => ({
  useCreateMaintenanceRequest: () => ({ mutateAsync: createMutate, isPending: false }),
  useAssignMaintenanceRequest: () => ({ mutateAsync: assignMutate, isPending: false }),
  useStartMaintenanceRequest: () => ({ mutateAsync: startMutate, isPending: false }),
  useResolveMaintenanceRequest: () => ({ mutateAsync: resolveMutate, isPending: false }),
  useCloseMaintenanceRequest: () => ({ mutateAsync: closeMutate, isPending: false }),
  useDeleteMaintenanceRequest: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import MaintenanceList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { ownerMaintenance: ownerMaintenanceReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MaintenanceList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Owner Maintenance List', () => {
  beforeEach(() => {
    useAuthRoleMock.mockReset();
    hasPermissionMock.mockReset();
    useMyCinemasMock.mockReset();
    useMyEmployeesMock.mockReset();
    useRoomsByCinemaMock.mockReset();
    useSeatsByRoomMock.mockReset();
    useOwnerMaintenanceMock.mockReset();
    createMutate.mockReset();
    assignMutate.mockReset();
    startMutate.mockReset();
    resolveMutate.mockReset();
    closeMutate.mockReset();
    deleteMutate.mockReset();
    confirmDialogMock.mockReset();

    useAuthRoleMock.mockReturnValue(ROLES.owner);
    hasPermissionMock.mockReturnValue(true);
    useMyCinemasMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Branch A' }] } });
    useMyEmployeesMock.mockReturnValue({ data: { data: [{ id: 5, name: 'John Tech', email: 'john@example.com', status: 1 }] } });
    useRoomsByCinemaMock.mockReturnValue({ data: { data: [{ id: 1, name: 'Room 1' }] } });
    useSeatsByRoomMock.mockReturnValue({ data: [] });
  });

  it('renders request rows with resource, title, assignee and status', () => {
    useOwnerMaintenanceMock.mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            branch_id: 1,
            resource_type: 'ROOM',
            room_id: 1,
            resource_name: 'Room 1',
            title: 'Flicker',
            status: 'ASSIGNED',
            assigned_employee_id: 5,
          },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Flicker')).toBeInTheDocument();
    expect(screen.getByText('John Tech')).toBeInTheDocument();
    expect(screen.getByText('maintenance.status.ASSIGNED')).toBeInTheDocument();
  });

  it('shows "Unassigned" when no employee is assigned yet', () => {
    useOwnerMaintenanceMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'Frozen', status: 'OPEN', assigned_employee_id: null }], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('maintenance.unassigned')).toBeInTheDocument();
  });

  it('opens the add modal and creates a ROOM request', async () => {
    useOwnerMaintenanceMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createMutate.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByText('maintenance.addButton'));
    expect(screen.getByText('maintenance.addTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByText('maintenance.roomPlaceholder'));
    fireEvent.click(screen.getByText('Room 1'));

    const titleInput = document.querySelector('input[name="title"]') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Projector flickers' } });

    fireEvent.click(screen.getByText('maintenance.submit'));

    await waitFor(() =>
      expect(createMutate).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 1, resource_type: 'ROOM', room_id: 1, title: 'Projector flickers' }),
      ),
    );
  });

  it('assigns an employee to an OPEN request', async () => {
    useOwnerMaintenanceMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'Frozen', status: 'OPEN', assigned_employee_id: null }], totalPages: 1 },
    });
    assignMutate.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByText('maintenance.assign'));
    expect(screen.getByText('maintenance.assignTitle')).toBeInTheDocument();

    fireEvent.click(screen.getByText('maintenance.employeePlaceholder'));
    fireEvent.click(screen.getByText('John Tech'));

    fireEvent.click(screen.getByText('maintenance.submit'));
    await waitFor(() => expect(assignMutate).toHaveBeenCalledWith({ id: 1, employee_id: 5 }));
  });

  it('starts an ASSIGNED request', async () => {
    useOwnerMaintenanceMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'Frozen', status: 'ASSIGNED', assigned_employee_id: 5 }], totalPages: 1 },
    });
    startMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('maintenance.start'));
    await waitFor(() => expect(startMutate).toHaveBeenCalledWith(1));
  });

  it('resolves an IN_PROGRESS request with a note', async () => {
    useOwnerMaintenanceMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'Frozen', status: 'IN_PROGRESS', assigned_employee_id: 5 }], totalPages: 1 },
    });
    resolveMutate.mockResolvedValue({});
    renderPage();

    fireEvent.click(screen.getByText('maintenance.resolve'));
    expect(screen.getByText('maintenance.resolveTitle')).toBeInTheDocument();

    const noteInput = document.querySelector('textarea[name="resolution_note"]') as HTMLTextAreaElement;
    fireEvent.change(noteInput, { target: { value: 'Rebooted terminal' } });
    fireEvent.click(screen.getByText('maintenance.submit'));

    await waitFor(() => expect(resolveMutate).toHaveBeenCalledWith({ id: 1, resolution_note: 'Rebooted terminal' }));
  });

  it('closes a RESOLVED request', async () => {
    useOwnerMaintenanceMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'Frozen', status: 'RESOLVED', assigned_employee_id: 5 }], totalPages: 1 },
    });
    closeMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('maintenance.close'));
    await waitFor(() => expect(closeMutate).toHaveBeenCalledWith(1));
  });

  it('deletes an OPEN request after confirming', async () => {
    useOwnerMaintenanceMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'Frozen', status: 'OPEN', assigned_employee_id: null }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    deleteMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('maintenance.delete'));
    await waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1));
  });

  it('does not show the assign/close actions without the matching permission', () => {
    hasPermissionMock.mockImplementation((code: string) => code !== 'maintenance.assign' && code !== 'maintenance.close');
    useOwnerMaintenanceMock.mockReturnValue({
      data: { data: [{ id: 1, branch_id: 1, resource_type: 'POS', resource_name: 'Counter 1', title: 'Frozen', status: 'OPEN', assigned_employee_id: null }], totalPages: 1 },
    });
    renderPage();
    expect(screen.queryByText('maintenance.assign')).not.toBeInTheDocument();
  });

  it('shows the branch column and "all branches" option for an admin', () => {
    useAuthRoleMock.mockReturnValue(ROLES.admin);
    useOwnerMaintenanceMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('maintenance.allBranches')).toBeInTheDocument();
  });
});
