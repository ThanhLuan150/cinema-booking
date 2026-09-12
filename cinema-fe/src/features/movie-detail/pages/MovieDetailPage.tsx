import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { ROUTES } from '@/constants/routes';
import MovieBackdrop from '../components/MovieBackdrop';
import MovieDetailContent from '../components/MovieDetailContent';

const MovieDetailPage = () => {
  const { t } = useTranslation('movieDetail');
  const { id } = useParams<{ id: string }>();
  const { data: movie } = useMovieDetail(id);

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb
          items={[
            { label: t('bannerDetail.breadcrumbMovies'), href: ROUTES.playing },
            { label: movie?.name ?? '' },
          ]}
        />
        <MovieBackdrop />
        <MovieDetailContent />
      </div>
      <Footer />
    </div>
  );
};

export default MovieDetailPage;
