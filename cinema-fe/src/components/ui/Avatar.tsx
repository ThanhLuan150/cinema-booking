import { cn } from '@/lib/cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-24 w-24 text-3xl',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10 font-semibold text-white/60',
        sizeClasses[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name || 'avatar'} className="h-full w-full object-cover" />
      ) : (
        (name || '?').charAt(0).toUpperCase()
      )}
    </span>
  );
}
