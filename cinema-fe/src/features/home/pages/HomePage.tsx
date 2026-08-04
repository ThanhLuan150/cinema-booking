import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import Banner from '../components/BannerSlider';
import QuickBooking from '../components/QuickBooking';
import MovieTabs from '../components/MovieTabsSection';
import TopCinemas from '../components/TopCinemasSection';

const HomePage = () => {
  const { isLoading } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-20">
        {isLoading ? (
          <div className="flex min-h-[70vh] w-full items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <Banner />
            <QuickBooking />
            <div className="divide-y divide-border">
              <MovieTabs />
              <TopCinemas />
            </div>
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;
