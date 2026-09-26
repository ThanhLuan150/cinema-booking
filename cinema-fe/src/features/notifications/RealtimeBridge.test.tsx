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
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const { unmount } = render(
    <QueryClientProvider client={queryClient}>
      <Provider store={store}>
        <RealtimeBridge />
      </Provider>
    </QueryClientProvider>,
  );
  return { unmount, invalidateSpy };
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

  it('bumps ownerBookingVersion and toasts on booking:new', () => {
    renderBridge();
    const before = store.getState().realtime.ownerBookingVersion;
    emit('booking:new', { amount: 50000 });
    expect(store.getState().realtime.ownerBookingVersion).toBe(before + 1);
  });

  it('bumps cinemaStatusVersion and toasts on branch:activated, branch:disabled, branch:maintenance', () => {
    renderBridge();
    const before = store.getState().realtime.cinemaStatusVersion;
    emit('branch:activated', { name: 'A' });
    expect(store.getState().realtime.cinemaStatusVersion).toBe(before + 1);
    expect(store.getState().notifications.toasts.at(-1)?.type).toBe('success');
    emit('branch:disabled', { name: 'A' });
    expect(store.getState().realtime.cinemaStatusVersion).toBe(before + 2);
    expect(store.getState().notifications.toasts.at(-1)?.type).toBe('error');
    emit('branch:maintenance', { name: 'A' });
    expect(store.getState().realtime.cinemaStatusVersion).toBe(before + 3);
    expect(store.getState().notifications.toasts.at(-1)?.type).toBe('info');
  });

  it('invalidates the bookings query and toasts on showtime:cancelled', () => {
    const { invalidateSpy } = renderBridge();
    emit('showtime:cancelled', { bookingId: 1, scheduleId: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    expect(store.getState().notifications.toasts.at(-1)?.type).toBe('info');
  });

  it('invalidates the bookings query and toasts on showtime:rescheduled', () => {
    const { invalidateSpy } = renderBridge();
    emit('showtime:rescheduled', { bookingId: 1, scheduleId: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookings'] });
    expect(store.getState().notifications.toasts.at(-1)?.type).toBe('info');
  });

  // The INVALIDATIONS table is the bulk of the bridge: one listener per domain that just marks
  // the lists showing that domain as stale. A few representative rows stand in for the table.
  it.each([
    ['maintenance:updated', ['ownerMaintenance']],
    ['support:updated', ['supportTickets']],
    ['parking:updated', ['ownerParkingAreas']],
    ['inventory:updated', ['ownerInventory']],
    ['purchaseOrder:updated', ['purchaseOrders']],
    ['purchaseOrder:updated', ['suppliers']],
    ['comboOrder:updated', ['comboOrders']],
    ['refund:updated', ['myRefunds']],
    ['payment:updated', ['myPayments']],
    ['privateEvent:updated', ['eventPackages']],
    ['signage:updated', ['ownerSignageScreens']],
    ['auditLog:new', ['auditLogs']],
    ['webhook:updated', ['webhooks']],
    ['integration:updated', ['integrations']],
    ['systemConfig:updated', ['systemConfig']],
    ['review:updated', ['adminReviews']],
    ['campaign:updated', ['ownerCampaigns']],
    ['employee:updated', ['myEmployees']],
    ['cashierShift:updated', ['cashierShifts']],
    ['shift:updated', ['ownerShiftAssignments']],
    ['attendance:updated', ['attendance']],
    ['checkin:new', ['ownerCheckinLogs']],
    ['device:updated', ['ownerDevices']],
    ['kiosk:updated', ['ownerKiosks']],
    ['entrance:updated', ['ownerEntrances']],
    ['room:updated', ['allRooms']],
    ['giftCard:updated', ['myGiftCards']],
    ['movie:updated', ['movies']],
    ['branch:updated', ['cinemas']],
    ['schedule:updated', ['adminSchedules']],
    ['catalogue:updated', ['actors']],
    ['like:updated', ['myLikedMovies']],
    ['user:updated', ['adminUsers']],
    ['loyalty:updated', ['myMembership']],
    ['notification:read', ['notifications']],
  ])('invalidates the matching queries on %s', (event, queryKey) => {
    const { invalidateSpy } = renderBridge();
    emit(event, { id: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey });
  });

  // Moving an employee to another Position changes what they may do — their own cached
  // permission set (which builds the sidebar) has to be dropped, not just the manager's roster.
  it('drops the employee’s own profile and permissions on employee:updated', () => {
    const { invalidateSpy } = renderBridge();
    emit('employee:updated', { id: 1, positionId: 3, status: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myEmployees'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['currentUser'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myPermissions'] });
  });

  // Being blocked or re-roled changes what this session may do, so the caller's own cached
  // profile and permission set have to go, not just the admin list they were changed from.
  it('drops the caller own profile and permissions on user:updated', () => {
    const { invalidateSpy } = renderBridge();
    emit('user:updated', { id: 1, status: 0 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['currentUser'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['myPermissions'] });
  });

  // A price rule or a holiday moves ticket prices, and the seat grid renders a price per seat —
  // so it has to be refetched, not just the pricing admin lists.
  it('invalidates the seat grid on pricing:updated', () => {
    const { invalidateSpy } = renderBridge();
    emit('pricing:updated', { id: 1 });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookedSeats'] });
  });

  // The employee hears about their own roster change as a toast. The list refresh already comes
  // from shift:updated, so myShift:updated must not invalidate anything itself (it would refetch twice).
  describe('myShift:updated', () => {
    const lastToast = () => store.getState().notifications.toasts.at(-1);

    it.each([
      ['CREATED', 'ACTIVE', 'realtimeBridge.myShiftAssigned'],
      ['UPDATED', 'ACTIVE', 'realtimeBridge.myShiftUpdated'],
      ['UPDATED', 'CANCELLED', 'realtimeBridge.myShiftCancelled'],
      ['DELETED', 'ACTIVE', 'realtimeBridge.myShiftRemoved'],
    ])('toasts the right message for %s / %s', (action, status, messageKey) => {
      renderBridge();
      const before = store.getState().notifications.toasts.length;
      emit('myShift:updated', {
        action,
        status,
        date: '2026-12-03',
        startAt: '2026-12-03T11:00:00.000Z',
        endAt: '2026-12-03T14:00:00.000Z',
      });
      expect(store.getState().notifications.toasts.length).toBe(before + 1);
      expect(lastToast()?.message).toBe(messageKey);
    });

    it('does not invalidate any query itself', () => {
      const { invalidateSpy } = renderBridge();
      emit('myShift:updated', { action: 'CREATED', status: 'ACTIVE', date: '2026-12-03' });
      expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('survives a payload without times', () => {
      renderBridge();
      expect(() => emit('myShift:updated', { action: 'UPDATED' })).not.toThrow();
    });
  });

  it('toasts an error only for a rejected door scan', () => {
    renderBridge();
    const before = store.getState().notifications.toasts.length;
    emit('checkin:new', { result: 'SUCCESS' });
    expect(store.getState().notifications.toasts.length).toBe(before);

    emit('checkin:new', { result: 'INVALID_QR' });
    expect(store.getState().notifications.toasts.at(-1)?.type).toBe('error');
  });

  it('bumps the operations counter for the branch-floor domains', () => {
    renderBridge();
    const before = store.getState().realtime.operationsVersion;
    emit('maintenance:updated', { id: 1 });
    emit('support:updated', { id: 1 });
    emit('parking:updated', { id: 1 });
    emit('inventory:updated', { id: 1 });
    expect(store.getState().realtime.operationsVersion).toBe(before + 4);
  });

  // A stock movement always refreshes the lists, but only the write that carries an item INTO
  // low/out of stock (lowStock: true, decided by the server from the previous status) warns staff.
  describe('inventory:updated low-stock warning', () => {
    const toasts = () => store.getState().notifications.toasts;

    it('toasts once when an item crosses into low stock', () => {
      renderBridge();
      const before = toasts().length;
      emit('inventory:updated', { id: 1, item: 'Popcorn', quantity: 4, status: 'LOW_STOCK', lowStock: true });
      expect(toasts().length).toBe(before + 1);
      expect(toasts().at(-1)?.type).toBe('info');
      expect(toasts().at(-1)?.message).toContain('realtimeBridge.inventoryLow');
    });

    it('stays quiet for an ordinary movement or one that happens while already low', () => {
      renderBridge();
      const before = toasts().length;
      emit('inventory:updated', { id: 1, item: 'Popcorn', quantity: 40, status: 'IN_STOCK', lowStock: false });
      emit('inventory:updated', { id: 1, item: 'Popcorn', quantity: 3, status: 'LOW_STOCK', lowStock: false });
      emit('inventory:updated', { id: 1 });
      expect(toasts().length).toBe(before);
    });

    it('still refreshes the inventory views when it warns', () => {
      renderBridge();
      const before = store.getState().realtime.operationsVersion;
      emit('inventory:updated', { id: 1, item: 'Popcorn', quantity: 0, status: 'OUT_OF_STOCK', lowStock: true });
      expect(store.getState().realtime.operationsVersion).toBe(before + 1);
    });
  });

  it('removes every listener it registered on unmount', () => {
    const { unmount } = renderBridge();
    expect((listeners.get('maintenance:updated') ?? []).length).toBeGreaterThan(0);
    unmount();
    expect(listeners.get('maintenance:updated') ?? []).toHaveLength(0);
    expect(listeners.get('booking:new') ?? []).toHaveLength(0);
    expect(listeners.get('unauthorized') ?? []).toHaveLength(0);
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
