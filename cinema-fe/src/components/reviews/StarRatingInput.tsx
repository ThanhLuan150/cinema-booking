import { useState } from 'react';
import { MAX_RATING } from '@/constants/rating';

export interface StarRatingInputProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function StarRatingInput({ value, onChange, max = MAX_RATING }: StarRatingInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          className="text-2xl leading-none text-gold transition-transform hover:scale-110"
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
        >
          {star <= display ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}
