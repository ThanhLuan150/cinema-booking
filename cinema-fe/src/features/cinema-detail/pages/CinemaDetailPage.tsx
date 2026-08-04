import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Breadcrumb } from '@/components/common/Breadcrumb';
import { ROUTES } from '@/constants/routes';
import { useCinemaDetail } from '../hooks/useCinemaDetail';
import CinemaBannerDetail from '../components/CinemaBannerDetail';
import CinemaMoviesSection from '../components/CinemaMoviesSection';
import CinemaReviews from '../components/CinemaReviews';

const CinemaDetailPage = () => {
  const { t } = useTranslation('cinemaDetail');
  const { id } = useParams<{ id: string }>();
  const { data: cinema } = useCinemaDetail(id);

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <Breadcrumb
          items={[
            { label: t('bannerDetail.breadcrumbCinemas'), href: ROUTES.cinemas },
            { label: cinema?.name ?? '' },
          ]}
        />
        <CinemaBannerDetail />
        <div className="divide-y divide-border">
          <CinemaMoviesSection />
          <CinemaReviews />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CinemaDetailPage;
