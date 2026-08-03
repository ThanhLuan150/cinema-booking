import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const variantClasses: Record<AlertVariant, string> = {
  info: 'bg-blue-950/60 text-blue-200 border-blue-800',
  success: 'bg-emerald-950/60 text-emerald-200 border-emerald-800',
  warning: 'bg-amber-950/60 text-amber-200 border-amber-800',
  error: 'bg-red-950/60 text-red-200 border-red-800',
};

const iconClasses: Record<AlertVariant, string> = {
  info: 'fa-solid fa-circle-info',
  success: 'fa-solid fa-circle-check',
  warning: 'fa-solid fa-triangle-exclamation',
  error: 'fa-solid fa-circle-exclamation',
};

export function Alert({ className, variant = 'info', children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <i className={cn(iconClasses[variant], 'mt-0.5 shrink-0')} aria-hidden="true" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
