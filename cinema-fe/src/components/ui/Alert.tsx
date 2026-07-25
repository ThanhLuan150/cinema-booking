import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

const variantClasses: Record<AlertVariant, string> = {
  info: 'bg-blue-950/60 text-blue-200 border-blue-800',
  success: 'bg-green-950/60 text-green-200 border-green-800',
  warning: 'bg-yellow-950/60 text-yellow-200 border-yellow-800',
  error: 'bg-red-950/60 text-red-200 border-red-800',
};

export function Alert({ className, variant = 'info', children, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn('rounded-md border px-4 py-3 text-sm', variantClasses[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
}
