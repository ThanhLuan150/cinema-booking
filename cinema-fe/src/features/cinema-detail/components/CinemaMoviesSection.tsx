import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import Like from '@/features/movies/components/Like';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';

const CinemaMoviesSection = () => {
  const { t } = useTranslation('cinemaDetail');
  const { id } = useParams<{ id: string }>();
  const { data: movies = [], isLoading } = useMovies({ cinema: id });

  return (
    <div id="showtimes" className="mx-auto w-4/5 py-8">
      <h5 className="mb-6 text-left text-2xl text-white">{t('moviesSection.title')}</h5>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : movies.length === 0 ? (
        <EmptyState title={t('moviesSection.emptyState')} />
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {movies.map((movie) => (
            <div key={movie.id} className="group overflow-hidden rounded-lg bg-white/5">
              <div className="overflow-hidden">
                <img
                  src={getMoviePosterUrl(movie.avatar)}
                  alt={movie.name}
                  className="h-[250px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h6 className="truncate text-base text-white">{movie.name}</h6>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(movie.categories || []).slice(0, MAX_VISIBLE_CATEGORIES).map((cat) => (
                    <span key={cat.id} className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">
                      {cat.name}
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <Like movieId={movie.id} />
                  <a
                    href={ROUTES.movieDetail(movie.id)}
                    className="rounded bg-accent px-3 py-1.5 text-xs text-white no-underline transition-colors hover:bg-white hover:text-accent"
                  >
                    {t('moviesSection.moreDetails')}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CinemaMoviesSection;
