import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { ROUTES } from '@/constants/routes';
import MovieBackdrop from '../components/MovieBackdrop';
import BannerDetail from '../components/BannerDetail';
import MovieShowtimes from '../components/MovieShowtimes';
import NowShowingSidebar from '../components/NowShowingSidebar';
import MovieReviews from '../components/MovieReviews';

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

        <div className="mx-auto grid w-full max-w-7xl gap-10 px-6 pb-16 md:px-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="flex min-w-0 flex-col gap-12">
            <BannerDetail />
            <MovieShowtimes />
            <MovieReviews />
          </main>
          <aside className="min-w-0 lg:pt-4">
            <NowShowingSidebar />
          </aside>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MovieDetailPage;
