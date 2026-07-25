import {
  ButtonHTMLAttributes,
  KeyboardEvent,
  forwardRef,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'value'> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  value?: string | number;
  name?: string;
  onChange?: (event: { target: { name?: string; value: string } }) => void;
  onBlur?: (event: { target: { name?: string } }) => void;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      id,
      options,
      placeholder,
      value,
      name,
      disabled,
      onChange,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const allOptions = placeholder ? [{ label: placeholder, value: '' }, ...options] : options;
    const selectedIndex = Math.max(
      allOptions.findIndex((option) => String(option.value) === String(value ?? '')),
      0,
    );
    const selectedOption = allOptions[selectedIndex];

    const close = () => {
      setIsOpen(false);
      onBlur?.({ target: { name } });
    };

    useEffect(() => {
      if (!isOpen) return;
      setActiveIndex(selectedIndex);
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          close();
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const selectOption = (option: SelectOption) => {
      onChange?.({ target: { name, value: String(option.value) } });
      setIsOpen(false);
      onBlur?.({ target: { name } });
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          return;
        }
        setActiveIndex((current) => {
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          return Math.min(Math.max(current + delta, 0), allOptions.length - 1);
        });
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (allOptions[activeIndex]) {
          selectOption(allOptions[activeIndex]);
        }
      } else if (event.key === 'Escape') {
        close();
      }
    };

    return (
      <div className="flex flex-col gap-1 z-10">
        {label && (
          <label htmlFor={id} className="text-sm font-medium">
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
            onKeyDown={handleKeyDown}
            className={cn(
              'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-main',
              'focus:outline-none focus:ring-2',
              disabled && 'cursor-not-allowed opacity-50',
              error
                ? 'border-red-600 bg-red-50 focus:ring-red-600'
                : 'border-txt/30 bg-white focus:ring-accent',
              className,
            )}
            {...props}
          >
            <span className={cn('truncate', !selectedOption?.value && selectedOption?.label === placeholder && 'text-main/40')}>
              {selectedOption?.label || placeholder}
            </span>
            <i className={cn('fa-solid fa-chevron-down ml-2 text-xs text-main/50 transition-transform', isOpen && 'rotate-180')} />
          </button>

          {isOpen && (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-txt/10 bg-white py-1 shadow-lg"
            >
              {allOptions.map((option, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      'flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-main',
                      index === activeIndex && 'bg-accent/10',
                      isSelected && 'font-medium text-accent',
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && <i className="fa-solid fa-check text-xs" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {error && (
          <span className="flex items-center gap-1 text-sm text-red-600">
            <i className="fa-solid fa-circle-exclamation text-xs" />
            {error}
          </span>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
