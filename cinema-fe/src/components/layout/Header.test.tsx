import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '@/app/store';
import { login, logout } from '@/features/auth/store/authSlice';

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

import { Header } from './Header';

function renderHeader() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Header />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

describe('Header', () => {
  beforeEach(() => {
    store.dispatch(logout());
    useCurrentUserMock.mockReturnValue({ data: undefined });
  });

  it('shows a login link when logged out', () => {
    renderHeader();
    expect(screen.getByText('header.login')).toBeInTheDocument();
  });

  it('shows the user menu toggle when logged in', () => {
    store.dispatch(login({ token: 'tok', userId: '1', role: '1', account: {} as any }));
    useCurrentUserMock.mockReturnValue({ data: { name: 'Alice' } });
    renderHeader();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('header.login')).not.toBeInTheDocument();
  });

  it('toggles the search box open', () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText('header.toggleSearch'));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('shows the manage link only for management roles', () => {
    store.dispatch(login({ token: 'tok', userId: '1', role: '0', account: {} as any }));
    useCurrentUserMock.mockReturnValue({ data: { name: 'Admin' } });
    renderHeader();
    fireEvent.click(screen.getByLabelText('header.toggleUserMenu'));
    expect(screen.getByText('header.manage')).toBeInTheDocument();
  });
});
