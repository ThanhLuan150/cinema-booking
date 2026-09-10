import '@/i18n';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({ useCurrentUser: () => ({ data: undefined }) }));

const useMyCrmProfileMock = vi.fn();
vi.mock('../hooks/useMyCrmProfile', () => ({ useMyCrmProfile: () => useMyCrmProfileMock() }));

import MyActivityPage from './MyActivityPage';

function renderPage() {
  const queryClient = new QueryClient();
  const store = configureStore({ reducer: { auth: authReducer } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <MyActivityPage />
        </MemoryRouter>
      </Provider>
    </QueryClientProvider>,
  );
}

const sampleProfile = {
  customer_id: 1,
  name: 'Me',
  email: 'me@example.com',
  phone: '',
  member_since: '2025-01-01T00:00:00.000Z',
  scope: 'ALL' as const,
  branch_ids: null,
  total_bookings: 4,
  total_tickets: 6,
  total_spending: 800000,
  total_combo_spending: 100000,
  favorite_genres: [{ id: 1, name: 'Drama', bookings: 3 }],
  favorite_branch: { branch_id: 1, name: 'Central', bookings: 3 },
  last_visit: '2026-01-10T10:00:00.000Z',
  membership_level: 'SILVER',
  membership_level_name: 'Silver',
  loyalty_points: 120,
  lifetime_points: 900,
};

describe('MyActivityPage', () => {
  beforeEach(() => useMyCrmProfileMock.mockReset());

  it('shows a spinner while loading', () => {
    useMyCrmProfileMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderPage();
    expect(screen.queryByText('Central')).not.toBeInTheDocument();
  });

  it('renders the profile card when loaded', () => {
    useMyCrmProfileMock.mockReturnValue({ data: sampleProfile, isLoading: false, isError: false });
    renderPage();
    expect(screen.getByText('Central')).toBeInTheDocument();
    expect(screen.getByText('Drama')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows an error state on failure', () => {
    useMyCrmProfileMock.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderPage();
    expect(screen.getByText(/couldn't load the activity summary/i)).toBeInTheDocument();
  });
});
