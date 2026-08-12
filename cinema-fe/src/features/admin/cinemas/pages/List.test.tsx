import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
import realtimeReducer from '@/features/notifications/realtimeSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) =>
        key === 'cinemas.headers' && opts?.returnObjects ? ['ID', 'Name', 'Owner', 'Address', 'Status', 'Actions'] : key,
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useAdminCinemasMock = vi.fn();
vi.mock('../hooks/useAdminCinemas', () => ({
  adminCinemasQueryKey: ['adminCinemas'],
  useAdminCinemas: (...args: unknown[]) => useAdminCinemasMock(...args),
}));

const activateMutate = vi.fn();
const disableMutate = vi.fn();
const maintenanceMutate = vi.fn();
const deleteMutate = vi.fn();
const createBranchAdminMutate = vi.fn();
vi.mock('../hooks/useCinemaModeration', () => ({
  useActivateCinema: () => ({ mutateAsync: activateMutate }),
  useDisableCinema: () => ({ mutateAsync: disableMutate }),
  useSetCinemaMaintenance: () => ({ mutateAsync: maintenanceMutate }),
  useDeleteCinema: () => ({ mutateAsync: deleteMutate }),
  useCreateBranchAdmin: () => ({ mutateAsync: createBranchAdminMutate, isPending: false }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import AdminCinemasList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer, realtime: realtimeReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminCinemasList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Admin Cinemas List', () => {
  beforeEach(() => {
    useAdminCinemasMock.mockReset();
    activateMutate.mockReset();
    disableMutate.mockReset();
    maintenanceMutate.mockReset();
    deleteMutate.mockReset();
    createBranchAdminMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders an inactive branch with activate/disable/maintenance/delete actions', () => {
    useAdminCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42, address: 'Addr', city: 'HN', status: 'INACTIVE' }], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('cinemas.activateButton')).toBeInTheDocument();
  });

  it('activates a branch', async () => {
    useAdminCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42, address: 'Addr', city: 'HN', status: 'INACTIVE' }], totalPages: 1 },
    });
    activateMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('cinemas.activateButton'));
    await vi.waitFor(() => expect(activateMutate).toHaveBeenCalledWith(1));
  });

  it('disables a branch after confirming', async () => {
    useAdminCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42, address: 'Addr', city: 'HN', status: 'ACTIVE' }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    disableMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('cinemas.disableButton'));
    await vi.waitFor(() => expect(disableMutate).toHaveBeenCalledWith(1));
  });

  it('sets a branch to maintenance after confirming', async () => {
    useAdminCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42, address: 'Addr', city: 'HN', status: 'ACTIVE' }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    maintenanceMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('cinemas.maintenanceButton'));
    await vi.waitFor(() => expect(maintenanceMutate).toHaveBeenCalledWith(1));
  });

  it('opens the add-branch-admin modal from the add button', () => {
    useAdminCinemasMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    fireEvent.click(screen.getByText('cinemas.addBranchAdmin.addButton'));
    expect(screen.getByText('cinemas.addBranchAdmin.title')).toBeInTheDocument();
  });

  it('blocks submitting the add-branch-admin form when required fields are empty', async () => {
    useAdminCinemasMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    createBranchAdminMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('cinemas.addBranchAdmin.addButton'));
    fireEvent.click(screen.getByText('cinemas.addBranchAdmin.submit'));
    await vi.waitFor(() => expect(createBranchAdminMutate).not.toHaveBeenCalled());
  });
});
