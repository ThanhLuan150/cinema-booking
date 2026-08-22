import { forwardRef, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useFloatingPosition, type FloatingPosition } from './useFloatingPosition';

export interface TimeInputProps {
  label?: string;
  error?: string;
  id?: string;
  name?: string;
  value?: string; // 'HH:mm', same wire format the native <input type="time"> produced
  onChange?: (event: { target: { name?: string; value: string } }) => void;
  onBlur?: (event: { target: { name?: string } }) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  stepMinutes?: number; // default 30
}

function buildSlots(stepMinutes: number): string[] {
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const h = String(Math.floor(minutes / 60)).padStart(2, '0');
    const m = String(minutes % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
}

// Same visual/interaction family as DateInput and Select: a styled trigger button opening a
// portaled, floating dropdown (see useFloatingPosition) instead of the browser's native
// <input type="time"> control (whose look can't be themed and varies by browser/OS).
export const TimeInput = forwardRef<HTMLButtonElement, TimeInputProps>(
  ({ label, error, id, name, value, onChange, onBlur, placeholder, disabled, className, stepMinutes = 30 }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeSlot, setActiveSlot] = useState(value || '');
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);
    const optionRefs = useRef(new Map<string, HTMLLIElement>());
    const [position, setPosition] = useState<FloatingPosition | null>(null);

    const slots = useMemo(() => buildSlots(stepMinutes), [stepMinutes]);

    const close = () => {
      setIsOpen(false);
      onBlur?.({ target: { name } });
    };

    useEffect(() => {
      if (!isOpen) return;
      setActiveSlot(value && slots.includes(value) ? value : slots[0]);
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (containerRef.current?.contains(target)) return;
        if (dropdownRef.current?.contains(target)) return;
        close();
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      optionRefs.current.get(activeSlot)?.scrollIntoView({ block: 'nearest' });
    }, [isOpen, activeSlot]);

    useFloatingPosition(isOpen, containerRef, dropdownRef, position, setPosition);

    const selectSlot = (slot: string) => {
      onChange?.({ target: { name, value: slot } });
      setIsOpen(false);
      onBlur?.({ target: { name } });
    };

    const moveActive = (delta: number) => {
      setActiveSlot((current) => {
        const index = slots.indexOf(current);
        const nextIndex = Math.min(Math.max((index === -1 ? 0 : index) + delta, 0), slots.length - 1);
        return slots[nextIndex];
      });
    };

    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          return;
        }
        moveActive(event.key === 'ArrowDown' ? 1 : -1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          selectSlot(activeSlot);
        }
      } else if (event.key === 'Escape') {
        close();
      }
    };

    return (
      <div className="relative flex flex-col gap-1.5">
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
            aria-haspopup="listbox"
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
            <span className={cn('truncate', !value && 'text-txt/35')}>{value || placeholder || ''}</span>
            <i className={cn('fa-regular fa-clock ml-2 shrink-0 text-xs text-txt/50', value && !disabled && 'mr-5')} />
          </button>
          {value && !disabled && (
            <button
              type="button"
              aria-label="Clear time"
              onClick={(event) => {
                event.stopPropagation();
                onChange?.({ target: { name, value: '' } });
              }}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-txt/50 transition-colors hover:bg-white/10 hover:text-txt"
            >
              <i className="fa-solid fa-xmark text-xs" />
            </button>
          )}
          {isOpen &&
            position &&
            createPortal(
              <ul
                ref={dropdownRef}
                role="listbox"
                aria-label={label || 'Choose a time'}
                style={{ top: position.top, left: position.left, width: Math.max(position.width, 120) }}
                className="themed-scrollbar fixed z-[60] max-h-60 overflow-auto rounded-lg border border-border-strong bg-surface-raised py-1 shadow-raised"
              >
                {slots.map((slot) => {
                  const isSelected = slot === value;
                  const isActive = slot === activeSlot;
                  return (
                    <li
                      key={slot}
                      ref={(el) => {
                        if (el) optionRefs.current.set(slot, el);
                        else optionRefs.current.delete(slot);
                      }}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveSlot(slot)}
                      onClick={() => selectSlot(slot)}
                      className={cn(
                        'flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-txt',
                        isActive && 'bg-accent/15',
                        isSelected && 'font-medium text-accent',
                      )}
                    >
                      <span>{slot}</span>
                      {isSelected && <i className="fa-solid fa-check text-xs" />}
                    </li>
                  );
                })}
              </ul>,
              document.body,
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

TimeInput.displayName = 'TimeInput';
