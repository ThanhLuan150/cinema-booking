import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSeatSwapOptions, quoteSeatSwap, swapTicketSeat } from '../api/booking.api';
import { myTicketsQueryKey } from './useMyTickets';
import { ticketQueryKey } from './useTicket';

export const seatSwapOptionsQueryKey = (ticketId: number | string) =>
  ['seatSwapOptions', ticketId] as const;

/** Request Seat Change: eligibility (+ reason), policy and the current seat. */
export function useSeatSwapOptions(ticketId: number | string, enabled = true) {
  return useQuery({
    queryKey: seatSwapOptionsQueryKey(ticketId),
    queryFn: () => getSeatSwapOptions(ticketId),
    enabled,
    // Always ask again when the modal opens — the policy or the showtime may have changed.
    staleTime: 0,
  });
}

/** Check Availability: a dry run of the swap; nothing is reserved. */
export function useSeatSwapQuote(ticketId: number | string) {
  return useMutation({
    mutationFn: (seatCode: string) => quoteSeatSwap(ticketId, seatCode),
  });
}

/** Confirm: moves the ticket, then refreshes the ticket, the ticket list and the showtime's seat map. */
export function useSwapSeat(ticketId: number | string, showtimeId: number | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (seatCode: string) => swapTicketSeat(ticketId, seatCode),
    onSuccess: (result) => {
      queryClient.setQueryData(ticketQueryKey(ticketId), result.ticket);
      queryClient.invalidateQueries({ queryKey: ticketQueryKey(ticketId) });
      queryClient.invalidateQueries({ queryKey: myTicketsQueryKey });
      queryClient.invalidateQueries({ queryKey: seatSwapOptionsQueryKey(ticketId) });
      if (showtimeId) queryClient.invalidateQueries({ queryKey: ['bookedSeats', showtimeId] });
    },
  });
}
