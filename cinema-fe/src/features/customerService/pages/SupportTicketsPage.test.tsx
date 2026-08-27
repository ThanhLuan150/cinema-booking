import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';
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

vi.mock('@/features/auth/hooks/useAuth', () => ({ useAuthRole: () => ROLES.employee }));
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: { cinema_id: 1 } }) }));
vi.mock('@/features/owner/hooks/useMyCinemas', () => ({ useMyCinemas: () => ({ data: { data: [] } }) }));
vi.mock('@/features/owner/hooks/useMyEmployees', () => ({
  useMyEmployees: () => ({ data: { data: [{ id: 5, name: 'Bob', email: 'bob@example.com', status: 1 }] } }),
}));
vi.mock('../components/CustomerLabel', () => ({ CustomerLabel: ({ customerId }: { customerId: number }) => <span>Customer#{customerId}</span> }));
vi.mock('../components/CustomerPicker', () => ({ CustomerPicker: () => <div>customer-picker</div> }));

const hasPermissionMock = vi.fn();
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: hasPermissionMock }) }));

const useSupportTicketsMock = vi.fn();
vi.mock('../hooks/useSupportTickets', () => ({ useSupportTickets: (...args: unknown[]) => useSupportTicketsMock(...args) }));

const claimMutate = vi.fn();
const assignMutate = vi.fn();
const resolveMutate = vi.fn();
const closeMutate = vi.fn();
const deleteMutate = vi.fn();
const createMutate = vi.fn();
vi.mock('../hooks/useSupportTicketMutations', () => ({
  useCreateSupportTicket: () => ({ mutateAsync: createMutate, isPending: false }),
  useClaimSupportTicket: () => ({ mutateAsync: claimMutate, isPending: false }),
  useAssignSupportTicket: () => ({ mutateAsync: assignMutate, isPending: false }),
  useResolveSupportTicket: () => ({ mutateAsync: resolveMutate, isPending: false }),
  useCloseSupportTicket: () => ({ mutateAsync: closeMutate, isPending: false }),
  useDeleteSupportTicket: () => ({ mutateAsync: deleteMutate, isPending: false }),
}));

const confirmDialogMock = vi.fn();
vi.mock('@/features/notifications/confirm', () => ({ confirmDialog: (...args: unknown[]) => confirmDialogMock(...args) }));

import SupportTicketsPage from './SupportTicketsPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <SupportTicketsPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    customer_id: 10,
    branch_id: 1,
    category: 'GENERAL',
    subject: 'Cannot check in',
    status: 'OPEN',
    assigned_employee_id: null,
    ...overrides,
  };
}

describe('SupportTicketsPage', () => {
  beforeEach(() => {
    hasPermissionMock.mockReset();
    useSupportTicketsMock.mockReset();
    claimMutate.mockReset();
    assignMutate.mockReset();
    resolveMutate.mockReset();
    closeMutate.mockReset();
    deleteMutate.mockReset();
    createMutate.mockReset();
    confirmDialogMock.mockReset();
  });

  it('renders a ticket row and hides the claim action without permission', () => {
    hasPermissionMock.mockReturnValue(false);
    useSupportTicketsMock.mockReturnValue({ data: { data: [ticket()], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('Cannot check in')).toBeInTheDocument();
    expect(screen.queryByText('claim')).not.toBeInTheDocument();
    expect(screen.queryByText('newButton')).not.toBeInTheDocument();
  });

  it('claims an OPEN ticket when the caller has supportTicket.update', async () => {
    hasPermissionMock.mockImplementation((code: string) => code === 'supportTicket.update');
    useSupportTicketsMock.mockReturnValue({ data: { data: [ticket()], totalPages: 1 } });
    claimMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('claim'));
    await vi.waitFor(() => expect(claimMutate).toHaveBeenCalledWith(1));
  });

  it('shows the resolve action for an IN_PROGRESS ticket assigned to the caller', () => {
    hasPermissionMock.mockImplementation((code: string) => code === 'supportTicket.update');
    useSupportTicketsMock.mockReturnValue({ data: { data: [ticket({ status: 'IN_PROGRESS', assigned_employee_id: 5 })], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('resolve')).toBeInTheDocument();
    expect(screen.queryByText('claim')).not.toBeInTheDocument();
  });

  it('shows the close action for a RESOLVED ticket only with supportTicket.close', () => {
    hasPermissionMock.mockImplementation((code: string) => code === 'supportTicket.close');
    useSupportTicketsMock.mockReturnValue({ data: { data: [ticket({ status: 'RESOLVED' })], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('close')).toBeInTheDocument();
  });

  it('deletes an OPEN ticket after confirmation when the caller has supportTicket.delete', async () => {
    hasPermissionMock.mockImplementation((code: string) => code === 'supportTicket.delete');
    useSupportTicketsMock.mockReturnValue({ data: { data: [ticket()], totalPages: 1 } });
    confirmDialogMock.mockResolvedValue(true);
    deleteMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('delete'));
    await vi.waitFor(() => expect(deleteMutate).toHaveBeenCalledWith(1));
  });

  it('shows the New Ticket button with supportTicket.create', () => {
    hasPermissionMock.mockImplementation((code: string) => code === 'supportTicket.create');
    useSupportTicketsMock.mockReturnValue({ data: { data: [], totalPages: 1 } });
    renderPage();
    expect(screen.getByText('newButton')).toBeInTheDocument();
  });
});
