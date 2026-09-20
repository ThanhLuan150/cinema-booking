import { useEffect } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { socket, joinScheduleRoom, leaveScheduleRoom } from '@/lib/socket';
import { REALTIME_EVENT } from '@/lib/realtimeEvents';
import type { SeatUpdateEvent } from '@/features/notifications/types/realtime.types';

// Live seat map for one showtime, shared by the three surfaces that render a seat grid: the
// customer booking page, the box office and the kiosk. All three are looking at the same seats
// and all three can take them, so whichever one moves first has to show up on the other two.
//
// This is not in RealtimeBridge because a `schedule:<id>` room is per-showtime and short-lived:
// only the component with a seat grid on screen knows which showtime to subscribe to, and each
// surface caches the grid under its own query key.
//
// The event carries no identity (seat codes + their new status only), so we refetch rather than
// patch the cache — the server is what decides which of those seats are the caller's own hold.
export function useScheduleSeatSync(scheduleId: number | string | null | undefined, queryKey: QueryKey) {
  const queryClient = useQueryClient();
  // The key is an array rebuilt on every render; serialising it keeps the effect from
  // re-subscribing each time without asking every caller to memoise.
  const serializedKey = JSON.stringify(queryKey);

  useEffect(() => {
    if (scheduleId === null || scheduleId === undefined || scheduleId === '') return undefined;

    joinScheduleRoom(scheduleId);
    const onSeatUpdate = (payload: SeatUpdateEvent) => {
      // Leaving a room is async, so a socket can briefly still receive events for a showtime the
      // page has navigated away from — refetching on those would reload the wrong grid.
      if (payload?.scheduleId !== undefined && String(payload.scheduleId) !== String(scheduleId)) return;
      queryClient.invalidateQueries({ queryKey: JSON.parse(serializedKey) as QueryKey });
    };

    socket.on(REALTIME_EVENT.SEAT_UPDATED, onSeatUpdate);
    return () => {
      socket.off(REALTIME_EVENT.SEAT_UPDATED, onSeatUpdate);
      leaveScheduleRoom(scheduleId);
    };
  }, [scheduleId, serializedKey, queryClient]);
}
