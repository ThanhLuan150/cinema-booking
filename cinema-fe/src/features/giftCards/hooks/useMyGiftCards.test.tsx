import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/store/authSlice';

const getMyGiftCardsMock = vi.fn();
vi.mock('../api/giftCard.api', () => ({ getMyGiftCards: (...args: unknown[]) => getMyGiftCardsMock(...args) }));

import { useMyGiftCards } from './useMyGiftCards';

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

describe('useMyGiftCards', () => {
  beforeEach(() => getMyGiftCardsMock.mockReset());

  it('fetches the caller\'s gift cards when authenticated', async () => {
    getMyGiftCardsMock.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useMyGiftCards(1, 20), { wrapper: wrapperWithAuth('token') });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMyGiftCardsMock).toHaveBeenCalledWith(1, 20);
  });

  it('does not fetch when unauthenticated', () => {
    const { result } = renderHook(() => useMyGiftCards(1, 20), { wrapper: wrapperWithAuth(null) });
    expect(result.current.fetchStatus).toBe('idle');
    expect(getMyGiftCardsMock).not.toHaveBeenCalled();
  });
});
