import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';

export interface MovieCardMovie {
  id: number | string;
  name: string;
  avatar?: string | null;
  categories?: { id: number | string; name: string }[];
}

export interface MovieCardProps {
  movie: MovieCardMovie;
  ctaLabel: string;
  className?: string;
}

export function MovieCard({ movie, ctaLabel, className }: MovieCardProps) {
  return (
    <Link
      to={ROUTES.movieDetail(movie.id)}
      className={cn(
        'group relative block aspect-[2/3] overflow-hidden rounded-xl bg-surface no-underline shadow-card ring-1 ring-border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-raised hover:ring-accent/50',
        className,
      )}
    >
      <img
        src={getMoviePosterUrl(movie.avatar)}
        alt={movie.name}
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />

      <span className="absolute right-3 top-3 flex h-9 w-9 scale-75 items-center justify-center rounded-full bg-accent text-white opacity-0 shadow-glow transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
        <i className="fa-solid fa-play text-xs" aria-hidden="true" />
      </span>

      <div className="absolute inset-x-0 bottom-0 p-3.5">
        {(movie.categories || []).length > 0 && (
          <div className="mb-1.5 flex max-h-0 flex-wrap gap-1.5 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-h-8 group-hover:opacity-100">
            {movie.categories!.slice(0, MAX_VISIBLE_CATEGORIES).map((cat) => (
              <span
                key={cat.id}
                className="rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-medium text-accent"
              >
                {cat.name}
              </span>
            ))}
          </div>
        )}
        <h6 className="truncate text-sm font-semibold text-white">{movie.name}</h6>
        <span className="mt-1 flex max-h-0 items-center gap-1 overflow-hidden text-xs font-medium text-accent opacity-0 transition-all duration-300 group-hover:max-h-5 group-hover:opacity-100">
          {ctaLabel}
          <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
