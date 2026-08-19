import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, opts?: any) => {
        if (key === 'users.list.headers' && opts?.returnObjects) {
          return ['ID', 'Name', 'Phone', 'Email', 'Role', 'Status', 'Actions'];
        }
        return key;
      },
      i18n: { resolvedLanguage: 'en', language: 'en', changeLanguage: vi.fn() },
    }),
  };
});
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useAdminUsersMock = vi.fn();
vi.mock('../hooks/useAdminUsers', () => ({ useAdminUsers: (...args: unknown[]) => useAdminUsersMock(...args) }));

const approveMutate = vi.fn();
vi.mock('../hooks/useApproveUser', () => ({ useApproveUser: () => ({ mutateAsync: approveMutate, isPending: false }) }));

import AdminUsersList from './List';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminUsersList />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Admin Users List', () => {
  beforeEach(() => {
    useAdminUsersMock.mockReset();
    approveMutate.mockReset();
  });

  it('renders a user row', () => {
    useAdminUsersMock.mockReturnValue({
      data: {
        data: [{ id: 1, name: 'Alice', phone: '0912345678', email: 'a@b.com', role: 1, status: 1, approved: true }],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('shows every role as a static label, not an editable dropdown', () => {
    useAdminUsersMock.mockReturnValue({
      data: {
        data: [
          { id: 1, name: 'Admin', phone: '', email: 'admin@b.com', role: 0, status: 1, approved: true },
          { id: 2, name: 'Owner', phone: '', email: 'owner@b.com', role: 2, status: 1, approved: true },
          { id: 3, name: 'Staff', phone: '', email: 'staff@b.com', role: 3, status: 1, approved: true },
        ],
        totalPages: 1,
      },
    });
    renderPage();
    expect(screen.getByText('users.list.roles.admin')).toBeInTheDocument();
    expect(screen.getByText('users.list.roles.theater')).toBeInTheDocument();
    expect(screen.getByText('users.list.roles.employee')).toBeInTheDocument();
    const table = screen.getByText('Admin').closest('table');
    expect(table?.querySelector('button[aria-haspopup="listbox"]')).not.toBeInTheDocument();
  });

  it('shows an approve button for a pending theater owner', async () => {
    useAdminUsersMock.mockReturnValue({
      data: {
        data: [{ id: 2, name: 'Owner', phone: '', email: 'owner@b.com', role: 2, status: 1, approved: false }],
        totalPages: 1,
      },
    });
    approveMutate.mockResolvedValue({});
    renderPage();
    fireEvent.click(screen.getByText('users.list.approveButton'));
    await vi.waitFor(() => expect(approveMutate).toHaveBeenCalledWith(2));
  });
});
