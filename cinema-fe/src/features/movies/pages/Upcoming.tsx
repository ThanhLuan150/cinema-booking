import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import Like from '../components/Like';
import { MovieFilterBar } from '../components/MovieFilterBar';
import { useMovies } from '../hooks/useMovies';
import { resetFilters, setFilters } from '../store/moviesSlice';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';
import { MOVIE_GRID_PAGE_SIZE } from '@/constants/pagination';

const Upcomingg = () => {
  const { t } = useTranslation('movies');
  const dispatch = useAppDispatch();
  const filters = useAppSelector((state) => state.movies.filters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(resetFilters());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data, isLoading } = useMovies({ ...filters, status: 'upcoming' }, { page, limit: MOVIE_GRID_PAGE_SIZE });
  const upcomingMovies = data?.data ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-24">
        <div className="border-b border-white/10">
          <div className="mx-auto flex w-4/5 items-center gap-2 py-3 text-sm text-txt/70">
            <a href={ROUTES.home} className="text-txt/70 no-underline hover:text-accent">
              <i className="fa-solid fa-house" />
            </a>
            <i className="fa-solid fa-chevron-right text-xs text-accent" />
            <a href={ROUTES.home} className="text-txt/70 no-underline hover:text-accent">
              {t('upcoming.breadcrumbMovie')}
            </a>
            <i className="fa-solid fa-chevron-right text-xs text-accent" />
            <span className="font-semibold text-white">{t('upcoming.breadcrumbCurrent')}</span>
          </div>
        </div>

        <div className="mx-auto w-4/5 py-8">
          <h5 className="mb-6 text-2xl text-white">{t('upcoming.title')}</h5>
          <MovieFilterBar filters={filters} onChange={(next) => dispatch(setFilters(next))} />
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : upcomingMovies.length === 0 ? (
            <p className="text-txt/70">{t('upcoming.empty')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {upcomingMovies.map((movie) => (
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
                        {t('upcoming.moreDetails')}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Upcomingg;
