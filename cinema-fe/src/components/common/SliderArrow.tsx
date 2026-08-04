import type { CSSProperties } from 'react';

export interface SliderArrowProps {
  /** Injected by react-slick. */
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  direction: 'next' | 'prev';
  label: string;
}

/** Circular carousel arrow shared by the poster/cinema rows, matching the hero banner arrows. */
export function SliderArrow({ className, style, onClick, direction, label }: SliderArrowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`${className} !z-10 !flex !h-10 !w-10 !items-center !justify-center !rounded-full !border !border-border-strong !bg-surface-raised text-txt transition-colors before:!content-none hover:!border-accent hover:!bg-accent hover:!text-white ${
        direction === 'next' ? '!-right-4' : '!-left-4'
      }`}
      aria-label={label}
    >
      <i className={`fa-solid fa-chevron-${direction === 'next' ? 'right' : 'left'} text-sm`} />
    </button>
  );
}
