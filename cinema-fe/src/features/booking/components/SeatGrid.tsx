import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useBookedSeats } from '../hooks/useBookedSeats';
import { useRoomSeats } from '../hooks/useRoomSeats';
import { useHoldSeats } from '../hooks/useHoldSeats';
import { useReleaseSeats } from '../hooks/useReleaseSeats';
import { setSeatHoldExpiry, toggleSeat } from '../store/bookingSlice';
import type { SeatCell } from '../types/booking.types';
import { buildSeatCells, groupSeatRows } from '../utils/seatCells';
import { SEAT_TYPE_CLASS, SEAT_TYPE_KEY, SEAT_TYPES } from '@/constants/seatType';

function seatCellClass(cell: SeatCell, isSelected: boolean) {
  if (cell.status === 'DISABLED') return 'cursor-not-allowed bg-white/10 text-white/30 line-through';
  if (cell.status === 'BOOKED') return 'cursor-not-allowed bg-white/25';
  if (cell.status === 'HELD' && !cell.ticket?.held_by_me) return 'cursor-not-allowed bg-white/40';
  return cn(
    'cursor-pointer hover:scale-110',
    SEAT_TYPE_CLASS[cell.seatType] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard],
    isSelected && 'scale-110 bg-emerald-500 text-white ring-2 ring-white',
  );
}

function seatCellTitle(cell: SeatCell, t: TFunction) {
  if (cell.status === 'DISABLED') return t('bookSeat.legend.disabled');
  if (cell.status === 'BOOKED') return t('bookSeat.legend.sold');
  if (cell.status === 'HELD') return t(cell.ticket?.held_by_me ? 'bookSeat.legend.selecting' : 'bookSeat.legend.held');
  return t(`bookSeat.legend.${SEAT_TYPE_KEY[cell.seatType] ?? 'standard'}`);
}

export function SeatGrid({ scheduleId, roomId }: { scheduleId: number | null; roomId: number | null }) {
  const { t } = useTranslation('booking');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const selectedSeatCodes = useAppSelector((state) => state.booking.selectedSeatCodes);
  const { data: ticketList = [], isLoading } = useBookedSeats(scheduleId);
  const { data: roomSeats = [] } = useRoomSeats(roomId);
  const holdSeatsMutation = useHoldSeats(scheduleId);
  const releaseSeatsMutation = useReleaseSeats(scheduleId);
  const isMutating = holdSeatsMutation.isPending || releaseSeatsMutation.isPending;

  if (!scheduleId || isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  if (ticketList.length === 0) {
    return (
      <EmptyState
        title={t('bookSeat.noSeatMap.title')}
        description={t('bookSeat.noSeatMap.description')}
      />
    );
  }

  const rows = groupSeatRows(buildSeatCells(ticketList, roomSeats));

  const handleSelect = (cell: SeatCell) => {
    if (!cell.ticket) return;
    const ticket = cell.ticket;
    const isSelected = selectedSeatCodes.includes(cell.seatCode);
    if (isSelected) {
      // Release optimistically — worst case the hold simply expires on its own TTL.
      dispatch(toggleSeat(ticket));
      releaseSeatsMutation.mutate([cell.seatCode]);
      return;
    }
    holdSeatsMutation.mutate([cell.seatCode], {
      onSuccess: (result) => {
        dispatch(toggleSeat(ticket));
        if (result?.held_until) {
          dispatch(setSeatHoldExpiry({ seatCode: cell.seatCode, heldUntil: result.held_until }));
        }
      },
      onError: (error) => {
        toast.error(getApiErrorMessage(error, t));
        queryClient.invalidateQueries({ queryKey: ['bookedSeats', scheduleId] });
      },
    });
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {Object.keys(rows)
        .sort()
        .map((rowLetter) => (
          <div className="flex gap-1" key={rowLetter}>
            {rows[rowLetter].map((cell) => {
              const isSelected = selectedSeatCodes.includes(cell.seatCode);
              const isSelectable =
                !isMutating && cell.ticket && (cell.status === 'AVAILABLE' || (cell.status === 'HELD' && cell.ticket.held_by_me));
              return (
                <button
                  type="button"
                  key={cell.seatCode}
                  title={seatCellTitle(cell, t)}
                  className={cn(
                    'flex h-8 w-9 items-center justify-center rounded-t-lg text-[10px] font-semibold text-black transition-transform',
                    seatCellClass(cell, isSelected),
                  )}
                  onClick={() => isSelectable && handleSelect(cell)}
                >
                  {cell.seatCode}
                </button>
              );
            })}
          </div>
        ))}
    </div>
  );
}
