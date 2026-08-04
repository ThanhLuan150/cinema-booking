import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';

export interface MovieCardMovie {
  id: number | string;
  name: string;
  avatar?: string | null;
  categories?: { id: number | string; name: string }[];
  premiere_date?: string;
  country?: string;
}

export interface MovieCardProps {
  movie: MovieCardMovie;
  ctaLabel: string;
  className?: string;
}

export function MovieCard({ movie, ctaLabel, className }: MovieCardProps) {
  const { t } = useTranslation('common');
  const today = new Date().toISOString().split('T')[0];
  const isUpcoming = !!movie.premiere_date && movie.premiere_date > today;
  const genres = (movie.categories || [])
    .slice(0, MAX_VISIBLE_CATEGORIES)
    .map((cat) => cat.name)
    .join(', ');

  return (
    <article className={cn('group flex flex-col', className)}>
      <div className="relative overflow-hidden rounded-xl bg-surface shadow-card ring-1 ring-border transition-all duration-300 group-hover:shadow-raised group-hover:ring-accent/50">
        <Link to={ROUTES.movieDetail(movie.id)} className="block aspect-[2/3] no-underline">
          <img
            src={getMoviePosterUrl(movie.avatar)}
            alt={movie.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </Link>

        {isUpcoming && (
          <span className="absolute left-2.5 top-2.5 rounded-md bg-main/85 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold backdrop-blur-sm">
            {t('movieCard.releasesOn', { date: formatShortDate(movie.premiere_date!) })}
          </span>
        )}

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-main/80 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:pointer-events-auto group-hover:opacity-100">
          <Link
            to={ROUTES.bookTicket(movie.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold uppercase tracking-wide text-white no-underline shadow-glow transition-colors hover:bg-accent-hover"
          >
            <i className="fa-solid fa-ticket" aria-hidden="true" />
            {t('actions.buyTicket')}
          </Link>
          <Link
            to={ROUTES.movieDetail(movie.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-4 py-2 text-xs font-medium text-white no-underline transition-colors hover:border-accent hover:text-accent"
          >
            {ctaLabel}
            <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="mt-3 px-0.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-white transition-colors group-hover:text-accent">
          <Link to={ROUTES.movieDetail(movie.id)} className="text-inherit no-underline">
            {movie.name}
          </Link>
        </h3>
        {(genres || movie.country) && (
          <p className="mt-1.5 truncate text-xs text-txt/55">
            {[genres, movie.country].filter(Boolean).join(' • ')}
          </p>
        )}
      </div>
    </article>
  );
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split('T')[0].split('-');
  return day && month ? `${day}/${month}` : year;
}
