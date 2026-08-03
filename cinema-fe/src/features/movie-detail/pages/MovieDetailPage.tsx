import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import BannerDetail from '../components/BannerDetail';
import CastSection from '../components/CastSection';
import DetailTrailer from '../components/DetailTrailer';
import OtherSlider from '../components/OtherMovieSlider';
import MovieReviews from '../components/MovieReviews';

const MovieDetailPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        <BannerDetail />
        <CastSection />
        <DetailTrailer />
        <MovieReviews />
        <OtherSlider />
      </div>
      <Footer />
    </div>
  );
};

export default MovieDetailPage;
