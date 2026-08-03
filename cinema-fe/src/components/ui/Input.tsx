import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-txt/90">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'rounded-lg border bg-surface-soft px-3 py-2.5 text-txt placeholder:text-txt/35',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-600/60 focus:ring-red-600/50'
              : 'border-border-strong focus:border-accent focus:ring-accent/40',
            className,
          )}
          {...props}
        />
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

Input.displayName = 'Input';
