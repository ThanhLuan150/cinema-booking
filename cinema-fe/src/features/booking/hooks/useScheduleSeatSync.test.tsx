import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Handler = (...args: unknown[]) => void;

const { listeners, socketMock, joinScheduleRoomMock, leaveScheduleRoomMock } = vi.hoisted(() => {
  const listeners = new Map<string, Handler[]>();
  return {
    listeners,
    joinScheduleRoomMock: vi.fn(),
    leaveScheduleRoomMock: vi.fn(),
    socketMock: {
      on: vi.fn((event: string, handler: Handler) => {
        listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      }),
      off: vi.fn((event: string, handler: Handler) => {
        listeners.set(event, (listeners.get(event) ?? []).filter((h) => h !== handler));
      }),
    },
  };
});

vi.mock('@/lib/socket', () => ({
  socket: socketMock,
  joinScheduleRoom: joinScheduleRoomMock,
  leaveScheduleRoom: leaveScheduleRoomMock,
}));

import { useScheduleSeatSync } from './useScheduleSeatSync';

function emit(event: string, payload?: unknown) {
  (listeners.get(event) ?? []).forEach((handler) => handler(payload));
}

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useScheduleSeatSync', () => {
  beforeEach(() => {
    listeners.clear();
    joinScheduleRoomMock.mockClear();
    leaveScheduleRoomMock.mockClear();
    client = new QueryClient();
  });

  it('subscribes to the showtime and refetches the caller own grid on a seat change', () => {
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useScheduleSeatSync(5, ['employeeScheduleSeats', 5]), { wrapper });

    expect(joinScheduleRoomMock).toHaveBeenCalledWith(5);
    emit('seat:updated', { scheduleId: 5, seatCodes: ['A1'], status: 'HELD' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['employeeScheduleSeats', 5] });
  });

  it('leaves the room and unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useScheduleSeatSync(5, ['bookedSeats', 5]), { wrapper });
    unmount();

    expect(leaveScheduleRoomMock).toHaveBeenCalledWith(5);
    expect(listeners.get('seat:updated') ?? []).toHaveLength(0);
  });

  it('does nothing without a showtime', () => {
    renderHook(() => useScheduleSeatSync(null, ['bookedSeats', null]), { wrapper });
    expect(joinScheduleRoomMock).not.toHaveBeenCalled();
  });

  // Leaving a room is async, so a socket can still receive events for a showtime the page has
  // navigated away from.
  it('ignores a seat change on a different showtime', () => {
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useScheduleSeatSync(5, ['bookedSeats', 5]), { wrapper });

    emit('seat:updated', { scheduleId: 9, seatCodes: ['A1'], status: 'HELD' });
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  // The query key is an array literal rebuilt on every render; re-subscribing on each one would
  // churn the room membership, so the effect keys off the serialised value instead.
  it('does not resubscribe when the caller passes a fresh key array each render', () => {
    const { rerender } = renderHook(() => useScheduleSeatSync(5, ['bookedSeats', 5]), { wrapper });
    rerender();
    rerender();

    expect(joinScheduleRoomMock).toHaveBeenCalledTimes(1);
    expect(leaveScheduleRoomMock).not.toHaveBeenCalled();
  });
});
