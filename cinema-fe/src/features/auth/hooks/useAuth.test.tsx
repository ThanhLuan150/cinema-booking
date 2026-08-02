import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { login, logout } from '@/features/auth/store/authSlice';
import type { Account } from '@/types/entities';
import { useIsAuthenticated, useAuthToken, useAuthRole, useCurrentAccountId } from './useAuth';

function wrapper({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}

describe('auth hooks', () => {
  beforeEach(() => {
    store.dispatch(logout());
  });

  it('useIsAuthenticated is false with no token, true after login', () => {
    const { result, rerender } = renderHook(() => useIsAuthenticated(), { wrapper });
    expect(result.current).toBe(false);
    act(() => {
      store.dispatch(login({ token: 'tok', userId: '1', role: '1', account: {} as Account }));
    });
    rerender();
    expect(result.current).toBe(true);
  });

  it('useAuthToken returns the current token', () => {
    store.dispatch(login({ token: 'abc', userId: '1', role: '1', account: {} as Account }));
    const { result } = renderHook(() => useAuthToken(), { wrapper });
    expect(result.current).toBe('abc');
  });

  it('useAuthRole returns the role as a number, or null', () => {
    const { result, rerender } = renderHook(() => useAuthRole(), { wrapper });
    expect(result.current).toBeNull();
    act(() => {
      store.dispatch(login({ token: 'tok', userId: '1', role: '2', account: {} as Account }));
    });
    rerender();
    expect(result.current).toBe(2);
  });

  it('useCurrentAccountId returns the account id, or null', () => {
    const { result, rerender } = renderHook(() => useCurrentAccountId(), { wrapper });
    expect(result.current).toBeNull();
    act(() => {
      store.dispatch(login({ token: 'tok', userId: '1', role: '1', account: { id: 7 } as Account }));
    });
    rerender();
    expect(result.current).toBe(7);
  });
});
