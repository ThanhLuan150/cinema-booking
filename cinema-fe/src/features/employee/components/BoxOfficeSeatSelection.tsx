import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { cn } from '@/lib/cn';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';
import { TICKET_STATUS } from '@/constants/ticketStatus';
import type { BookedSeatTicket } from '@/features/booking/types/booking.types';

export function BoxOfficeSeatSelection({
  tickets,
  selectedSeatCodes,
  locked,
  lockPending,
  onToggleSeat,
  onLockSeats,
}: {
  tickets: BookedSeatTicket[] | undefined;
  selectedSeatCodes: string[];
  locked: boolean;
  lockPending: boolean;
  onToggleSeat: (seatCode: string) => void;
  onLockSeats: () => void;
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
            const isSelected = selectedSeatCodes.includes(ticket.seat_code);
            const isAvailable = ticket.status === TICKET_STATUS.available || (isSelected && ticket.held_by_me);
            return (
              <button
                key={ticket.id}
                type="button"
                disabled={!isAvailable || locked}
                onClick={() => onToggleSeat(ticket.seat_code)}
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
      {!locked && (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          loading={lockPending}
          disabled={selectedSeatCodes.length === 0}
          onClick={onLockSeats}
        >
          {t('boxOffice.lockSeats')}
        </Button>
      )}
      {locked && <Badge variant="success">{t('boxOffice.seatsLocked')}</Badge>}
    </div>
  );
}
