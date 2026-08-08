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

const approveMutate = vi.fn();
const blockMutate = vi.fn();
const deleteMutate = vi.fn();
const createBranchAdminMutate = vi.fn();
vi.mock('../hooks/useCinemaModeration', () => ({
  useApproveCinema: () => ({ mutateAsync: approveMutate }),
  useBlockCinema: () => ({ mutateAsync: blockMutate }),
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
    approveMutate.mockReset();
    blockMutate.mockReset();
    deleteMutate.mockReset();
    createBranchAdminMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders a pending cinema with approve/block/delete actions', () => {
    useAdminCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42, address: 'Addr', city: 'HN', status: 0 }], totalPages: 1 },
    });
    renderPage();
    expect(screen.getByText('Cinema A')).toBeInTheDocument();
    expect(screen.getByText('cinemas.approveButton')).toBeInTheDocument();
  });

  it('approves a cinema', async () => {
    useAdminCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42, address: 'Addr', city: 'HN', status: 0 }], totalPages: 1 },
    });
    approveMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('cinemas.approveButton'));
    await vi.waitFor(() => expect(approveMutate).toHaveBeenCalledWith(1));
  });

  it('blocks a cinema after confirming', async () => {
    useAdminCinemasMock.mockReturnValue({
      data: { data: [{ id: 1, name: 'Cinema A', owner_id: 42, address: 'Addr', city: 'HN', status: 1 }], totalPages: 1 },
    });
    confirmDialogMock.mockResolvedValue(true);
    blockMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('cinemas.blockButton'));
    await vi.waitFor(() => expect(blockMutate).toHaveBeenCalledWith(1));
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
