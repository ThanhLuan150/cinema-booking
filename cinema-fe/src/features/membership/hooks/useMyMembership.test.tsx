import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

const getMySummaryMock = vi.fn();
vi.mock('../api/membership.api', () => ({ getMySummary: (...args: unknown[]) => getMySummaryMock(...args) }));

import { useMyMembership } from './useMyMembership';

function wrapperWithAuth(accessToken: string | null) {
  const client = new QueryClient();
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: { auth: { accessToken, userId: null, role: null, account: null } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </Provider>
    );
  };
}

describe('useMyMembership', () => {
  beforeEach(() => getMySummaryMock.mockReset());

  it('fetches the summary when authenticated', async () => {
    getMySummaryMock.mockResolvedValue({ membership_level: 'SILVER', points_balance: 40 });
    const { result } = renderHook(() => useMyMembership(), { wrapper: wrapperWithAuth('token') });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.points_balance).toBe(40);
  });

  it('does not fetch when unauthenticated', () => {
    const { result } = renderHook(() => useMyMembership(), { wrapper: wrapperWithAuth(null) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMySummaryMock).not.toHaveBeenCalled();
  });
});
