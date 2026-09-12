import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';
import type { BookedSeatTicket } from '@/features/booking/types/booking.types';

export function CounterSaleSeatGrid({
  tickets,
  selectedTicketIds,
  onToggleTicket,
}: {
  tickets: BookedSeatTicket[] | undefined;
  selectedTicketIds: number[];
  onToggleTicket: (ticketId: number) => void;
}) {
  const { t } = useTranslation('employee');
  return (
    <div className="mt-6">
      <h6 className="mb-3 font-semibold text-white">{t('counterSale.seatsTitle')}</h6>
      {!tickets || tickets.length === 0 ? (
        <EmptyState title={t('counterSale.noSeats')} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tickets.map((ticket) => {
            const isAvailable = ticket.status === 1;
            const isSelected = selectedTicketIds.includes(ticket.id);
            return (
              <button
                key={ticket.id}
                type="button"
                disabled={!isAvailable}
                onClick={() => onToggleTicket(ticket.id)}
                className={cn(
                  'h-9 min-w-[2.5rem] rounded px-2 text-xs font-medium text-white transition-opacity',
                  SEAT_TYPE_CLASS[ticket.seat_type] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard],
                  !isAvailable && 'cursor-not-allowed opacity-30',
                  isSelected && 'ring-2 ring-accent',
                )}
              >
                {ticket.seat_code}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
