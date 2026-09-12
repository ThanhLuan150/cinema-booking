import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';
import { TICKET_STATUS } from '@/constants/ticketStatus';
import type { KioskSeat } from '../types/kiosk.types';

export function SeatStep({
  seats,
  selectedSeatCodes,
  locked,
  seatTotal,
  busy,
  onToggleSeat,
  onBack,
  onConfirm,
}: {
  seats: KioskSeat[];
  selectedSeatCodes: string[];
  locked: boolean;
  seatTotal: number;
  busy: boolean;
  onToggleSeat: (seat: KioskSeat) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('kiosk');
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.seat')}</h2>
      <div className="flex flex-wrap gap-2">
        {seats.map((seat) => {
          const isSelected = selectedSeatCodes.includes(seat.seat_code);
          const isBooked = seat.status === TICKET_STATUS.sold;
          const takenByOther = seat.status !== TICKET_STATUS.available && !seat.held_by_me;
          return (
            <button
              key={seat.id}
              type="button"
              disabled={takenByOther || locked}
              onClick={() => onToggleSeat(seat)}
              className={cn(
                'h-10 min-w-[2.75rem] rounded px-2 text-xs font-medium text-white transition-opacity',
                SEAT_TYPE_CLASS[seat.seat_type] ?? SEAT_TYPE_CLASS[SEAT_TYPES.standard],
                (takenByOther || isBooked) && 'cursor-not-allowed opacity-30',
                isSelected && 'ring-2 ring-accent',
              )}
            >
              {seat.seat_code}
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-txt/70">{t('seat.selected', { count: selectedSeatCodes.length, total: seatTotal.toLocaleString() })}</p>
      <div className="mt-4 flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          {t('back')}
        </Button>
        <Button type="button" variant="danger" loading={busy} disabled={selectedSeatCodes.length === 0} onClick={onConfirm}>
          {t('seat.confirm')}
        </Button>
      </div>
    </section>
  );
}
