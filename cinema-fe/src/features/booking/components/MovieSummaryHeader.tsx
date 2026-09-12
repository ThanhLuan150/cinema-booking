import { useTranslation } from 'react-i18next';
import { getMoviePosterUrl } from '@/utils';
import type { Movie } from '@/types/entities';

export function MovieSummaryHeader({ movie }: { movie: Movie | undefined }) {
  const { t } = useTranslation('booking');

  return (
    <div className="flex items-center gap-4 border-b border-border px-6 py-5 md:px-10">
      {movie?.avatar && (
        <img
          src={getMoviePosterUrl(movie.avatar)}
          alt={movie.name}
          className="hidden aspect-[2/3] w-16 shrink-0 rounded-lg object-cover shadow-card sm:block"
        />
      )}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">
          {t('bookTicket.pageTitle')}
        </p>
        <h1 className="mt-1 text-xl font-bold uppercase text-white md:text-2xl">
          {movie?.name ?? ' '}
        </h1>
        {(movie?.categories || []).length > 0 && (
          <p className="mt-1 text-xs text-txt/55">
            {movie!.categories!.map((cat) => cat.name).join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
