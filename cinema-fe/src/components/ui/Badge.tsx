import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'gold' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-txt',
  accent: 'bg-accent text-white',
  success: 'bg-emerald-700/90 text-white',
  warning: 'bg-amber-600/90 text-white',
  gold: 'bg-gold/15 text-gold border border-gold/30',
  outline: 'border border-txt/25 text-txt/80',
};

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
