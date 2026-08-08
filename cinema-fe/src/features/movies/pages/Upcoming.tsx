import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { MovieCard } from '@/components/common/MovieCard';
import { SectionHeading } from '@/components/common/SectionHeading';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { MovieFilterBar } from '../components/MovieFilterBar';
import { useMovies } from '../hooks/useMovies';
import { resetFilters, setFilters } from '../store/moviesSlice';
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
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: t('upcoming.breadcrumbMovie') }, { label: t('upcoming.breadcrumbCurrent') }]} />

        <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
          <SectionHeading title={t('upcoming.title')} align="center" />
          <MovieFilterBar filters={filters} onChange={(next) => dispatch(setFilters(next))} />
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : upcomingMovies.length === 0 ? (
            <EmptyState title={t('upcoming.empty')} icon="fa-solid fa-clapperboard" />
          ) : (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {upcomingMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} ctaLabel={t('upcoming.moreDetails')} />
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
