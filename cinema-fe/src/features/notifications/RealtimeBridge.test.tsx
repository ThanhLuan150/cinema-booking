import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from '@/app/store';
import { logout } from '@/features/auth/store/authSlice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const refreshAccessTokenMock = vi.fn();
vi.mock('@/services/apiClient', () => ({
  default: vi.fn(),
  refreshAccessToken: (...args: unknown[]) => refreshAccessTokenMock(...args),
}));

type Handler = (...args: unknown[]) => void;

const { listeners, socketMock } = vi.hoisted(() => {
  const listeners = new Map<string, Handler[]>();
  const socketMock = {
    auth: {} as unknown,
    connected: false,
    connect: vi.fn(function (this: typeof socketMock) {
      this.connected = true;
    }),
    disconnect: vi.fn(function (this: typeof socketMock) {
      this.connected = false;
    }),
    on: vi.fn((event: string, handler: Handler) => {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      const list = listeners.get(event) ?? [];
      listeners.set(event, list.filter((h) => h !== handler));
    }),
  };
  return { listeners, socketMock };
});

vi.mock('@/lib/socket', () => ({ socket: socketMock }));

function emit(event: string, payload?: unknown) {
  (listeners.get(event) ?? []).forEach((handler) => handler(payload));
}

import { RealtimeBridge } from './RealtimeBridge';

function renderBridge() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <RealtimeBridge />
      </Provider>
    </QueryClientProvider>,
  );
}

describe('RealtimeBridge', () => {
  beforeEach(() => {
    listeners.clear();
    socketMock.connect.mockClear();
    socketMock.disconnect.mockClear();
    socketMock.connected = false;
    refreshAccessTokenMock.mockReset();
    store.dispatch(logout());
  });

  it('connects the socket without auth when logged out', () => {
    renderBridge();
    expect(socketMock.auth).toEqual({});
    expect(socketMock.connect).toHaveBeenCalled();
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderBridge();
    unmount();
    expect(socketMock.disconnect).toHaveBeenCalled();
  });

  it('bumps cinemaPendingVersion and toasts on cinema:pending', () => {
    renderBridge();
    const before = store.getState().realtime.cinemaPendingVersion;
    emit('cinema:pending', { name: 'New Cinema' });
    expect(store.getState().realtime.cinemaPendingVersion).toBe(before + 1);
    expect(store.getState().notifications.toasts.at(-1)?.type).toBe('info');
  });

  it('bumps ownerBookingVersion and toasts on booking:new', () => {
    renderBridge();
    const before = store.getState().realtime.ownerBookingVersion;
    emit('booking:new', { amount: 50000 });
    expect(store.getState().realtime.ownerBookingVersion).toBe(before + 1);
  });

  it('bumps cinemaStatusVersion on cinema:approved and cinema:blocked', () => {
    renderBridge();
    const before = store.getState().realtime.cinemaStatusVersion;
    emit('cinema:approved', { name: 'A' });
    expect(store.getState().realtime.cinemaStatusVersion).toBe(before + 1);
    emit('cinema:blocked', { name: 'A' });
    expect(store.getState().realtime.cinemaStatusVersion).toBe(before + 2);
  });

  it('refreshes the access token once for a burst of unauthorized events', async () => {
    refreshAccessTokenMock.mockResolvedValue('new-tok');
    renderBridge();

    // Two events firing before the first refresh resolves should still only trigger one call.
    act(() => {
      emit('unauthorized');
      emit('unauthorized');
    });
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.waitFor(() => expect(store.getState().auth.accessToken).toBe('new-tok'));
    });
  });
});
