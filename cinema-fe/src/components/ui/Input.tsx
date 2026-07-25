import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={id} className="text-sm font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'rounded-md border px-3 py-2 text-main placeholder:text-main/40',
            'focus:outline-none focus:ring-2',
            error
              ? 'border-red-600 bg-red-50 focus:ring-red-600'
              : 'border-txt/30 bg-white focus:ring-accent',
            className,
          )}
          {...props}
        />
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

Input.displayName = 'Input';
