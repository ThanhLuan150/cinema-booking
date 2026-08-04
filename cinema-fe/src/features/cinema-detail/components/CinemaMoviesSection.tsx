import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MovieGridCard } from '@/components/common/MovieGridCard';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const CinemaMoviesSection = () => {
  const { t } = useTranslation('cinemaDetail');
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useMovies({ cinema: id }, { limit: FULL_LIST_FETCH_LIMIT });
  const movies = data?.data ?? [];

  return (
    <div id="showtimes" className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      <SectionHeading title={t('moviesSection.title')} align="center" />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : movies.length === 0 ? (
        <EmptyState title={t('moviesSection.emptyState')} />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {movies.map((movie) => (
            <MovieGridCard key={movie.id} movie={movie} ctaLabel={t('moviesSection.moreDetails')} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CinemaMoviesSection;
