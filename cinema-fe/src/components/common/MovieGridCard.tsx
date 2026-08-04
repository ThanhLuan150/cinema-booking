import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');

  return (
    <article className="group flex flex-col">
      <div className="relative overflow-hidden rounded-xl bg-surface shadow-card ring-1 ring-border transition-all duration-300 group-hover:shadow-raised group-hover:ring-accent/50">
        <Link to={ROUTES.movieDetail(movie.id)} className="block aspect-[2/3] no-underline">
          <img
            src={getMoviePosterUrl(movie.avatar)}
            alt={movie.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-main/80 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
          <Link
            to={ROUTES.bookTicket(movie.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white no-underline shadow-glow transition-colors hover:bg-accent-hover"
          >
            <i className="fa-solid fa-ticket" aria-hidden="true" />
            {t('actions.buyTicket')}
          </Link>
        </div>
      </div>

      <div className="mt-3 flex flex-1 flex-col px-0.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-white transition-colors group-hover:text-accent">
          <Link to={ROUTES.movieDetail(movie.id)} className="text-inherit no-underline">
            {movie.name}
          </Link>
        </h3>
        <p className="mt-1.5 min-h-[1rem] truncate text-xs text-txt/55">
          {(movie.categories || [])
            .slice(0, MAX_VISIBLE_CATEGORIES)
            .map((cat) => cat.name)
            .join(', ')}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <Like movieId={movie.id} />
          <Link
            to={ROUTES.movieDetail(movie.id)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent no-underline transition-colors hover:text-accent-hover"
          >
            {ctaLabel}
            <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
