import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { EmptyState } from '@/components/feedback/EmptyState';

export function TimeChips({
  times,
  selectedTime,
  onSelect,
}: {
  times: string[];
  selectedTime: string;
  onSelect: (time: string) => void;
}) {
  const { t } = useTranslation('booking');

  return (
    <div className="border-b border-border px-6 py-6 md:px-10">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-txt/60">
        <i className="fa-regular fa-clock text-accent" />
        {t('bookTicket.timeLabel')}
      </h2>
      {times.length === 0 && <EmptyState title={t('bookTicket.noAvailableTimes')} />}
      <div className="flex flex-wrap gap-3">
        {times.map((time) => (
          <button
            key={time}
            type="button"
            className={cn(
              'min-w-[84px] rounded-lg border border-border-strong px-5 py-2.5 text-sm font-semibold text-txt transition-all hover:border-accent hover:text-white',
              selectedTime === time && 'border-accent bg-accent text-white shadow-glow',
            )}
            onClick={() => onSelect(time)}
          >
            {time}
          </button>
        ))}
      </div>
    </div>
  );
}
