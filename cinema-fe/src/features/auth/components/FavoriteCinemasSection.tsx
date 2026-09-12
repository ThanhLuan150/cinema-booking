import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { CinemaCard } from '@/components/common/CinemaCard';
import { useFavoriteCinemas } from '@/features/movies/hooks/useFavoriteCinemas';

export function FavoriteCinemasSection() {
  const { t } = useTranslation('auth');
  const favoriteCinemasQuery = useFavoriteCinemas();

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
      <h2 className="text-xl font-semibold">{t('profile.favoriteCinemas')}</h2>
      {favoriteCinemasQuery.isLoading && <Spinner size="sm" className="mt-3" />}
      {!favoriteCinemasQuery.isLoading && (favoriteCinemasQuery.data?.length ?? 0) === 0 && (
        <EmptyState title={t('profile.noFavoriteCinemas')} icon="fa-solid fa-building" />
      )}
      <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {favoriteCinemasQuery.data?.map((cinema) => (
          <CinemaCard key={cinema.id} cinema={cinema} />
        ))}
      </div>
    </div>
  );
}
