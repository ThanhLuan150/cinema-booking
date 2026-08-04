import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export interface BookingStepsProps {
  /** 1 = showtime, 2 = seats, 3 = payment, 4 = confirmation. */
  current: 1 | 2 | 3 | 4;
}

/** Galaxy-style progress rail shown on every screen of the booking flow. */
export function BookingSteps({ current }: BookingStepsProps) {
  const { t } = useTranslation('booking');
  const steps = [t('steps.showtime'), t('steps.seat'), t('steps.payment'), t('steps.done')];

  return (
    <ol className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-6 py-6 md:px-0">
      {steps.map((label, index) => {
        const step = index + 1;
        const isDone = step < current;
        const isCurrent = step === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                isCurrent && 'bg-accent text-white shadow-glow',
                isDone && 'bg-accent/20 text-accent',
                !isCurrent && !isDone && 'border border-border-strong text-txt/45',
              )}
            >
              {isDone ? <i className="fa-solid fa-check" aria-hidden="true" /> : step}
            </span>
            <span
              className={cn(
                'hidden whitespace-nowrap text-xs font-semibold uppercase tracking-wide sm:block',
                isCurrent ? 'text-white' : 'text-txt/45',
              )}
            >
              {label}
            </span>
            {step < steps.length && (
              <span
                className={cn('h-px flex-1', isDone ? 'bg-accent/40' : 'bg-border')}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
