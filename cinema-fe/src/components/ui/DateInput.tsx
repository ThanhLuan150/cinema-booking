import { forwardRef, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

export interface DateInputProps {
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  value?: string; // 'YYYY-MM-DD', same wire format the native <input type="date"> produced
  onChange?: (event: { target: { name?: string; value: string } }) => void;
  onBlur?: (event: { target: { name?: string } }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISODate(value?: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

// Weeks start on Sunday (native JS Date.getDay() convention: 0 = Sunday).
function getMonthWeeks(viewDate: Date): (Date | null)[][] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const DateInput = forwardRef<HTMLButtonElement, DateInputProps>(
  ({ label, error, id, name, value, onChange, onBlur, placeholder, disabled, className }, ref) => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dayRefs = useRef(new Map<string, HTMLButtonElement>());

    const selectedDate = useMemo(() => parseISODate(value), [value]);
    const today = useMemo(() => new Date(), []);
    const [viewDate, setViewDate] = useState(() => selectedDate ?? today);
    const [focusedDate, setFocusedDate] = useState(() => selectedDate ?? today);

    useEffect(() => {
      const next = selectedDate ?? today;
      setViewDate(next);
      setFocusedDate(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const close = () => {
      setIsOpen(false);
      onBlur?.({ target: { name } });
    };

    useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      dayRefs.current.get(toISODate(focusedDate))?.focus();
    }, [isOpen, focusedDate]);

    const locale = i18n?.language;

    const monthLabel = useMemo(
      () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(viewDate),
      [viewDate, locale],
    );

    const weekdayLabels = useMemo(() => {
      const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
      return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2023, 0, i + 1)));
    }, [locale]);

    const weeks = useMemo(() => getMonthWeeks(viewDate), [viewDate]);

    const displayValue = selectedDate
      ? new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(selectedDate)
      : '';

    const selectDay = (day: Date) => {
      onChange?.({ target: { name, value: toISODate(day) } });
      setIsOpen(false);
      onBlur?.({ target: { name } });
    };

    const goToMonth = (delta: number) => {
      setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
    };

    const moveFocus = (delta: number) => {
      setFocusedDate((current) => {
        const next = addDays(current, delta);
        setViewDate(next);
        return next;
      });
    };

    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        setIsOpen(true);
      } else if (event.key === 'Escape') {
        close();
      }
    };

    const handleGridKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          moveFocus(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          moveFocus(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveFocus(-7);
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveFocus(7);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          selectDay(focusedDate);
          break;
        case 'Escape':
          event.preventDefault();
          close();
          break;
        default:
          break;
      }
    };

    return (
      <div className={cn('relative flex flex-col gap-1.5', isOpen ? 'z-30' : 'z-10')}>
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-txt/90">
            {label}
          </label>
        )}
        <div className="relative" ref={containerRef}>
          <button
            ref={ref}
            type="button"
            id={id}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onClick={() => setIsOpen((open) => !open)}
            onKeyDown={handleTriggerKeyDown}
            className={cn(
              'flex w-full items-center justify-between rounded-lg border bg-surface-soft px-3 py-2.5 text-left text-txt',
              'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0',
              disabled && 'cursor-not-allowed opacity-50',
              error
                ? 'border-red-600/60 focus:ring-red-600/50'
                : 'border-border-strong focus:border-accent focus:ring-accent/40',
              className,
            )}
          >
            <span className={cn('truncate', !displayValue && 'text-txt/35')}>
              {displayValue || placeholder || ''}
            </span>
            <i className={cn('fa-regular fa-calendar ml-2 shrink-0 text-xs text-txt/50', displayValue && !disabled && 'mr-5')} />
          </button>
          {isOpen && (
            <div
              role="dialog"
              aria-label="Choose a date"
              className="absolute z-20 mt-1 rounded-lg border border-border-strong bg-surface-raised p-3 shadow-raised w-full"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goToMonth(-1)}
                  aria-label="Previous month"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-txt/70 hover:bg-white/10 hover:text-txt"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <span className="text-sm font-medium text-txt">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() => goToMonth(1)}
                  aria-label="Next month"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-txt/70 hover:bg-white/10 hover:text-txt"
                >
                  <i className="fa-solid fa-chevron-right text-xs" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs text-txt/50">
                {weekdayLabels.map((wd) => (
                  <span key={wd} className="py-1">
                    {wd}
                  </span>
                ))}
              </div>

              <div role="grid" className="grid grid-cols-7 gap-1">
                {weeks.flatMap((week, wi) =>
                  week.map((day, di) => {
                    if (!day) return <span key={`${wi}-${di}`} />;
                    const iso = toISODate(day);
                    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                    const isToday = isSameDay(day, today);
                    const isFocused = isSameDay(day, focusedDate);
                    return (
                      <button
                        key={iso}
                        ref={(el) => {
                          if (el) dayRefs.current.set(iso, el);
                          else dayRefs.current.delete(iso);
                        }}
                        type="button"
                        role="gridcell"
                        tabIndex={isFocused ? 0 : -1}
                        onClick={() => selectDay(day)}
                        onKeyDown={handleGridKeyDown}
                        onFocus={() => setFocusedDate(day)}
                        aria-selected={isSelected}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-md text-sm text-txt transition-colors hover:bg-accent/15',
                          'focus:outline-none focus:ring-2 focus:ring-accent/50',
                          isSelected && 'bg-accent font-semibold text-white hover:bg-accent',
                          !isSelected && isToday && 'ring-1 ring-accent/60',
                        )}
                      >
                        {day.getDate()}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          )}
        </div>
        {error && (
          <span className="flex items-center gap-1 text-sm text-red-400">
            <i className="fa-solid fa-circle-exclamation text-xs" />
            {error}
          </span>
        )}
      </div>
    );
  },
);

DateInput.displayName = 'DateInput';
