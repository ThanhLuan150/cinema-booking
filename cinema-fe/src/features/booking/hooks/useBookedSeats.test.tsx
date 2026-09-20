import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const getBookedSeatsMock = vi.fn();
vi.mock('../api/booking.api', () => ({ getBookedSeats: (...args: unknown[]) => getBookedSeatsMock(...args) }));

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

import { useBookedSeats } from './useBookedSeats';

function emit(event: string, payload?: unknown) {
  (listeners.get(event) ?? []).forEach((handler) => handler(payload));
}

let client: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useBookedSeats', () => {
  beforeEach(() => {
    getBookedSeatsMock.mockReset();
    listeners.clear();
    joinScheduleRoomMock.mockClear();
    leaveScheduleRoomMock.mockClear();
    client = new QueryClient();
  });

  it('is disabled when scheduleId is null', () => {
    const { result } = renderHook(() => useBookedSeats(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches the seat grid for a schedule', async () => {
    getBookedSeatsMock.mockResolvedValue([{ id: 1, seat_code: 'A1' }]);
    const { result } = renderHook(() => useBookedSeats(5), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getBookedSeatsMock).toHaveBeenCalledWith(5);
  });

  it('does not subscribe to a showtime room without a schedule', () => {
    renderHook(() => useBookedSeats(null), { wrapper });
    expect(joinScheduleRoomMock).not.toHaveBeenCalled();
  });

  it('joins the showtime room while the grid is on screen and leaves on unmount', () => {
    getBookedSeatsMock.mockResolvedValue([]);
    const { unmount } = renderHook(() => useBookedSeats(5), { wrapper });
    expect(joinScheduleRoomMock).toHaveBeenCalledWith(5);

    unmount();
    expect(leaveScheduleRoomMock).toHaveBeenCalledWith(5);
    expect(listeners.get('seat:updated') ?? []).toHaveLength(0);
  });

  it('refetches the grid when another customer takes or frees a seat', async () => {
    getBookedSeatsMock.mockResolvedValue([]);
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useBookedSeats(5), { wrapper });

    emit('seat:updated', { scheduleId: 5, seatCodes: ['A1'], status: 'HELD' });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['bookedSeats', 5] });
  });

  // A leave is async, so a socket can briefly still receive events for a showtime the page has
  // already navigated away from — refetching on those would reload the wrong grid.
  it('ignores a seat event for a different showtime', () => {
    getBookedSeatsMock.mockResolvedValue([]);
    const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useBookedSeats(5), { wrapper });

    emit('seat:updated', { scheduleId: 9, seatCodes: ['A1'], status: 'HELD' });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
