import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useBookedSeats } from '@/features/booking/hooks/useBookedSeats';
import { useRoomSeats } from '@/features/booking/hooks/useRoomSeats';
import { SeatLegend } from '@/features/booking/components/SeatLegend';
import { buildSeatCells, groupSeatRows } from '@/features/booking/utils/seatCells';
import type { SeatCell } from '@/features/booking/types/booking.types';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';

// Unlike the regular grid, clicking a seat here holds nothing: a group's seats are claimed all
// together (or not at all) at checkout. The grid stays live (useBookedSeats subscribes to the
// showtime's seat events), so a seat someone else takes meanwhile turns red in the selection.
const isFree = (cell: SeatCell) =>
  Boolean(cell.ticket) && (cell.status === 'AVAILABLE' || (cell.status === 'HELD' && cell.ticket?.held_by_me));

export function GroupSeatPicker({
  scheduleId,
  roomId,
  selectedTicketIds,
  maxSeats,
  onToggle,
}: {
  scheduleId: number | null;
  roomId: number | null;
  selectedTicketIds: number[];
  maxSeats: number | null;
  onToggle: (ticketId: number) => void;
}) {
  const { t } = useTranslation('groupBooking');
  const { data: tickets = [], isLoading } = useBookedSeats(scheduleId);
  const { data: roomSeats = [] } = useRoomSeats(roomId);

  if (!scheduleId || isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }
  if (tickets.length === 0) {
    return <EmptyState title={t('seats.empty.title')} description={t('seats.empty.description')} />;
  }

  const rows = groupSeatRows(buildSeatCells(tickets, roomSeats));
  const atLimit = maxSeats !== null && selectedTicketIds.length >= maxSeats;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-card">
      <div className="mx-auto mb-3 h-3 w-4/5 rounded-full bg-white/70 [box-shadow:0_0_30px_8px_rgba(255,255,255,0.35)]" />
      <p className="mb-6 text-center text-xs uppercase tracking-widest text-txt/50">{t('seats.screen')}</p>
      <div className="flex flex-col items-center gap-1 overflow-x-auto">
        {Object.keys(rows)
          .sort()
          .map((rowLetter) => (
            <div className="flex gap-1" key={rowLetter}>
              {rows[rowLetter].map((cell) => {
                const ticketId = cell.ticket?.id;
                const selected = ticketId !== undefined && selectedTicketIds.includes(ticketId);
                const free = isFree(cell);
                // A selected seat stays clickable (to drop it) even after someone else took it.
                const clickable = selected || (free && !atLimit);
                return (
                  <button
                    type="button"
                    key={cell.seatCode}
                    aria-pressed={selected}
                    aria-label={cell.seatCode}
                    title={selected && !free ? t('seats.takenMeanwhile') : cell.seatCode}
                    disabled={!clickable}
                    onClick={() => ticketId !== undefined && onToggle(ticketId)}
                    className={cn(
                      'flex h-8 w-9 items-center justify-center rounded-t-lg text-[10px] font-semibold text-black transition-transform',
                      cell.status === 'DISABLED' && 'cursor-not-allowed bg-white/10 text-white/30 line-through',
                      cell.status !== 'DISABLED' && !free && !selected && 'cursor-not-allowed bg-white/25',
                      free && !selected && cn('hover:scale-110', SEAT_TYPE_CLASS[cell.seatType] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard]),
                      free && !selected && atLimit && 'cursor-not-allowed opacity-50 hover:scale-100',
                      selected && free && 'scale-110 bg-emerald-500 text-white ring-2 ring-white',
                      selected && !free && 'scale-110 bg-red-600 text-white ring-2 ring-red-300',
                    )}
                  >
                    {cell.seatCode}
                  </button>
                );
              })}
            </div>
          ))}
      </div>
      <SeatLegend />
    </div>
  );
}
