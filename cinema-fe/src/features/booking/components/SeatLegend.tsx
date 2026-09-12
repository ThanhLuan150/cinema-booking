import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { SEAT_TYPE_CLASS, SEAT_TYPES } from '@/constants/seatType';

export function SeatLegend() {
  const { t } = useTranslation('booking');

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-border pt-5 text-xs text-txt/80">
      <span className="flex items-center gap-2">
        <span
          className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.standard])}
        />
        {t('bookSeat.legend.standard')}
      </span>
      <span className="flex items-center gap-2">
        <span className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.vip])} />
        {t('bookSeat.legend.vip')}
      </span>
      <span className="flex items-center gap-2">
        <span className={cn('h-5 w-6 rounded-t', SEAT_TYPE_CLASS[SEAT_TYPES.couple])} />
        {t('bookSeat.legend.couple')}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-5 w-6 rounded-t bg-emerald-500" />
        {t('bookSeat.legend.selecting')}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-5 w-6 rounded-t bg-white/40" />
        {t('bookSeat.legend.held')}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-5 w-6 rounded-t bg-white/25" />
        {t('bookSeat.legend.sold')}
      </span>
      <span className="flex items-center gap-2">
        <span className="h-5 w-6 rounded-t bg-white/10 line-through" />
        {t('bookSeat.legend.disabled')}
      </span>
    </div>
  );
}
