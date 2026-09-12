import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { MovieCard } from '@/components/common/MovieCard';
import { useMyInvoices } from '@/features/booking/hooks/useMyInvoices';
import { ROUTES } from '@/constants/routes';
import type { ProfileMovie } from '../types/auth.types';

export function BookedMoviesSection() {
  const { t } = useTranslation('auth');
  const bookingsQuery = useMyInvoices();

  const bookedMovies = (() => {
    const seen = new Set<number>();
    const list: ProfileMovie[] = [];
    for (const inv of bookingsQuery.data ?? []) {
      if (inv.movie && !seen.has(inv.movie.id)) {
        seen.add(inv.movie.id);
        list.push(inv.movie);
      }
    }
    return list;
  })();

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('profile.bookedMovies')}</h2>
        <Link to={ROUTES.myBookings} className="text-sm text-accent no-underline hover:underline">
          {t('profile.viewAll')}
        </Link>
      </div>
      {bookingsQuery.isLoading && <Spinner size="sm" className="mt-3" />}
      {!bookingsQuery.isLoading && bookedMovies.length === 0 && (
        <EmptyState title={t('profile.noBookedMovies')} icon="fa-solid fa-ticket" />
      )}
      <div className="mt-3 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {bookedMovies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} ctaLabel={t('profile.moreDetails')} />
        ))}
      </div>
    </div>
  );
}
