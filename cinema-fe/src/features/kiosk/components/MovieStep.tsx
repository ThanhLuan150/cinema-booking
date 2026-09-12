import { useTranslation } from 'react-i18next';
import type { KioskMovie } from '../types/kiosk.types';

export function MovieStep({ movies, isSuccess, onSelect }: { movies: KioskMovie[]; isSuccess: boolean; onSelect: (movie: KioskMovie) => void }) {
  const { t } = useTranslation('kiosk');
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">{t('steps.movie')}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {movies.map((movie) => (
          <button
            key={movie.id}
            type="button"
            onClick={() => onSelect(movie)}
            className="rounded-xl border border-border bg-surface p-4 text-left hover:border-accent/60"
          >
            <p className="font-semibold text-white">{movie.name}</p>
          </button>
        ))}
        {isSuccess && movies.length === 0 && <p className="text-sm text-txt/60">{t('empty.movies')}</p>}
      </div>
    </section>
  );
}
