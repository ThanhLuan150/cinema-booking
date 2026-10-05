import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppSelector } from '@/hooks/redux';
import { cancelWaitlistEntry, getMyWaitlist, getShowtimeWaitlist, joinWaitlist } from '../api/waitlist.api';
import type { WaitlistStatus } from '../types/waitlist.types';

export const waitlistQueryKey = ['waitlist'] as const;
export const showtimeWaitlistQueryKey = (scheduleId: number | null) => [...waitlistQueryKey, 'showtime', scheduleId] as const;

function useIsLoggedIn() {
  return useAppSelector((state) => !!state.auth.accessToken);
}

export function useMyWaitlist(page: number, limit: number, status?: WaitlistStatus[]) {
  const enabled = useIsLoggedIn();
  return useQuery({
    queryKey: [...waitlistQueryKey, 'mine', page, limit, status ?? []],
    queryFn: () => getMyWaitlist({ page, limit, status }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useShowtimeWaitlist(scheduleId: number | null) {
  const enabled = useIsLoggedIn() && !!scheduleId;
  return useQuery({
    queryKey: showtimeWaitlistQueryKey(scheduleId),
    queryFn: () => getShowtimeWaitlist(scheduleId as number),
    enabled,
  });
}

// Every waitlist change can also move seats on the map, so the seat grid refetches with it.
function useInvalidateWaitlist() {
  const queryClient = useQueryClient();
  return (scheduleId?: number) => {
    queryClient.invalidateQueries({ queryKey: waitlistQueryKey });
    if (scheduleId) queryClient.invalidateQueries({ queryKey: ['bookedSeats', scheduleId] });
  };
}

export function useJoinWaitlist() {
  const invalidate = useInvalidateWaitlist();
  return useMutation({
    mutationFn: joinWaitlist,
    onSuccess: (entry) => invalidate(entry.schedule_id),
  });
}

export function useCancelWaitlistEntry() {
  const invalidate = useInvalidateWaitlist();
  return useMutation({
    mutationFn: (id: number) => cancelWaitlistEntry(id),
    onSuccess: (entry) => invalidate(entry.schedule_id),
  });
}
