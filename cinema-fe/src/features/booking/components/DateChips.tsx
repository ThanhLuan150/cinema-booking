import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { ScheduleDateOption } from '../types/booking.types';

export function DateChips({
  schedules,
  selectedDay,
  onSelect,
}: {
  schedules: ScheduleDateOption[];
  selectedDay: string;
  onSelect: (movieDate: string) => void;
}) {
  const { t, i18n } = useTranslation('booking');
  const weekdayFormatter = new Intl.DateTimeFormat(i18n.language, { weekday: 'short' });
  const dayFormatter = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: '2-digit' });

  return (
    <div className="border-b border-border px-6 py-6 md:px-10">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-txt/60">
        <i className="fa-regular fa-calendar text-accent" />
        {t('bookTicket.dateLabel')}
      </h2>
      <div className="flex flex-wrap gap-3">
        {schedules.map((schedule) => {
          const day = new Date(schedule.movie_date);
          const isActive = selectedDay === schedule.movie_date;
          return (
            <button
              key={schedule.movie_date}
              type="button"
              className={cn(
                'flex h-[68px] w-[76px] flex-col items-center justify-center gap-0.5 rounded-xl border border-border-strong text-txt transition-all hover:border-accent hover:text-white',
                isActive && 'border-accent bg-accent text-white shadow-glow',
              )}
              onClick={() => onSelect(schedule.movie_date)}
            >
              <span className="text-[11px] font-medium uppercase opacity-80">
                {weekdayFormatter.format(day)}
              </span>
              <span className="text-base font-bold">{dayFormatter.format(day)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
