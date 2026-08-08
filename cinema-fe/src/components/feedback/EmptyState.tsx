import { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: string;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'fa-solid fa-inbox',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-14 text-center text-txt',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl text-txt/30">
        <i className={icon} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-txt/60">{description}</p>}
      {action}
    </div>
  );
}
