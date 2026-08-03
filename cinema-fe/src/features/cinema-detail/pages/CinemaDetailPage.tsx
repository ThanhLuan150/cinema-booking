import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import CinemaBannerDetail from '../components/CinemaBannerDetail';
import CinemaMoviesSection from '../components/CinemaMoviesSection';
import CinemaReviews from '../components/CinemaReviews';

const CinemaDetailPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <CinemaBannerDetail />
        <CinemaMoviesSection />
        <CinemaReviews />
      </div>
      <Footer />
    </div>
  );
};

export default CinemaDetailPage;
