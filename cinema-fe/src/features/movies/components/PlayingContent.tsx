import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { MovieCard } from '@/components/common/MovieCard';
import { SectionHeading } from '@/components/common/SectionHeading';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { MovieFilterBar } from './MovieFilterBar';
import { useMovies } from '../hooks/useMovies';
import { resetFilters, setFilters } from '../store/moviesSlice';
import { MOVIE_GRID_PAGE_SIZE } from '@/constants/pagination';

export function PlayingContent() {
  const { t } = useTranslation('movies');
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const filters = useAppSelector((state) => state.movies.filters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const cinema = searchParams.get('cinema');
    dispatch(resetFilters(cinema ? { cinema } : {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { data, isLoading } = useMovies({ ...filters, status: 'playing' }, { page, limit: MOVIE_GRID_PAGE_SIZE });
  const playingMovies = data?.data ?? [];

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      <SectionHeading title={t('playing.title')} align="center" />
      <MovieFilterBar filters={filters} onChange={(next) => dispatch(setFilters(next))} />
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : playingMovies.length === 0 ? (
        <EmptyState title={t('playing.empty')} icon="fa-solid fa-clapperboard" />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {playingMovies.map((movie) => (
            <MovieCard key={movie.id} movie={movie} ctaLabel={t('playing.moreDetails')} />
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
    </div>
  );
}
