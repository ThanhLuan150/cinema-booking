import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '@/app/store';
import { logout } from '@/features/auth/store/authSlice';

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

const useCurrentUserMock = vi.fn();
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

vi.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => true }),
}));

import { AdminLayout } from './AdminLayout';

function renderLayout() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AdminLayout breadcrumb="Movies">
            <div>Page Content</div>
          </AdminLayout>
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('AdminLayout', () => {
  beforeEach(() => {
    store.dispatch(logout());
  });

  it('renders the breadcrumb and children', () => {
    useCurrentUserMock.mockReturnValue({ data: { role: 2, name: 'Owner' } });
    renderLayout();
    expect(screen.getByText('Movies')).toBeInTheDocument();
    expect(screen.getByText('Page Content')).toBeInTheDocument();
  });

  it('shows admin-only nav links for an admin user', () => {
    useCurrentUserMock.mockReturnValue({ data: { role: 0, name: 'Admin' } });
    renderLayout();
    expect(screen.getByText('adminLayout.nav.user')).toBeInTheDocument();
    expect(screen.getByText('adminLayout.nav.transactions')).toBeInTheDocument();
  });

  it('hides admin-only nav links for a theater owner', () => {
    useCurrentUserMock.mockReturnValue({ data: { role: 2, name: 'Owner' } });
    renderLayout();
    expect(screen.queryByText('adminLayout.nav.user')).not.toBeInTheDocument();
    expect(screen.queryByText('adminLayout.nav.transactions')).not.toBeInTheDocument();
  });

  it('shows only employee nav links for an employee user', () => {
    useCurrentUserMock.mockReturnValue({ data: { role: 3, name: 'Staff' } });
    renderLayout();
    expect(screen.getByText('adminLayout.nav.counterSale')).toBeInTheDocument();
    expect(screen.getByText('adminLayout.nav.checkIn')).toBeInTheDocument();
    expect(screen.queryByText('adminLayout.nav.films')).not.toBeInTheDocument();
    expect(screen.queryByText('adminLayout.nav.employees')).not.toBeInTheDocument();
  });

  it('falls back to a generic display name when there is no user', () => {
    useCurrentUserMock.mockReturnValue({ data: undefined });
    renderLayout();
    expect(screen.getAllByText('adminLayout.adminFallback').length).toBeGreaterThan(0);
  });
});
