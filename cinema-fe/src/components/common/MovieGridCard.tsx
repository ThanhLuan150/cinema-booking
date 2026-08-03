import { Link } from 'react-router-dom';
import Like from '@/features/movies/components/Like';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';
import type { Movie } from '@/types/entities';

export interface MovieGridCardProps {
  movie: Movie;
  ctaLabel: string;
}

export function MovieGridCard({ movie, ctaLabel }: MovieGridCardProps) {
  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-border-strong hover:shadow-raised">
      <Link to={ROUTES.movieDetail(movie.id)} className="block aspect-[2/3] overflow-hidden">
        <img
          src={getMoviePosterUrl(movie.avatar)}
          alt={movie.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </Link>
      <div className="p-4">
        <Link
          to={ROUTES.movieDetail(movie.id)}
          className="block truncate text-sm font-semibold text-white no-underline hover:text-accent"
        >
          {movie.name}
        </Link>
        <div className="mt-2 flex min-h-[1.25rem] flex-wrap gap-1.5">
          {(movie.categories || []).slice(0, MAX_VISIBLE_CATEGORIES).map((cat) => (
            <span
              key={cat.id}
              className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent"
            >
              {cat.name}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          <Like movieId={movie.id} />
          <Link
            to={ROUTES.movieDetail(movie.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white no-underline shadow-card transition-colors hover:bg-accent-hover"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
