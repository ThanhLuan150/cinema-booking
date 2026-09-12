import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { MovieCard } from '@/components/common/MovieCard';
import { useMyLikedMovies } from '@/features/movies/hooks/useMyLikedMovies';

export function LikedMoviesSection() {
  const { t } = useTranslation('auth');
  const likedMoviesQuery = useMyLikedMovies();

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
      <h2 className="text-xl font-semibold">{t('profile.likedMovies')}</h2>
      {likedMoviesQuery.isLoading && <Spinner size="sm" className="mt-3" />}
      {!likedMoviesQuery.isLoading && (likedMoviesQuery.data?.length ?? 0) === 0 && (
        <EmptyState title={t('profile.noLikedMovies')} icon="fa-solid fa-heart" />
      )}
      <div className="mt-3 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {likedMoviesQuery.data?.map((movie) => (
          <MovieCard key={movie.id} movie={movie} ctaLabel={t('profile.moreDetails')} />
        ))}
      </div>
    </div>
  );
}
