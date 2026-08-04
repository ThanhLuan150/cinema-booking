import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { CinemaCard } from '@/components/common/CinemaCard';
import { SectionHeading } from '@/components/common/SectionHeading';
import { EmptyState } from '@/components/feedback/EmptyState';
import { getCinemasList } from '../api/movies.api';
import { MOVIE_GRID_PAGE_SIZE } from '@/constants/pagination';

const Cinemas = () => {
  const { t } = useTranslation('movies');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['cinemas', 'page', page],
    queryFn: () => getCinemasList({ page, limit: MOVIE_GRID_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const cinemas = data?.data ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb items={[{ label: t('cinemas.breadcrumb') }]} />

        <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
          <SectionHeading title={t('cinemas.title')} align="center" />
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : cinemas.length === 0 ? (
            <EmptyState title={t('cinemas.empty')} />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {cinemas.map((cinema) => (
                <CinemaCard key={cinema.id} cinema={cinema} />
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

export default Cinemas;
