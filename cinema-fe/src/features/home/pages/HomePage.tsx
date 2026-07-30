import { cn } from '@/lib/cn';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import Banner from '../components/BannerSlider';
import New from '../components/NewMoviesSlider';
import Trend from '../components/TrendingMoviesSlider';
import Upcoming from '../components/UpcomingMoviesSlider';
import TopCinemas from '../components/TopCinemasSlider';

const HomePage = () => {
  const { data, isLoading } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const hasBanner = !isLoading && (data?.data.length ?? 0) > 0;

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className={cn('flex-1', !hasBanner && 'pt-24')}>
        {isLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center w-100">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <Banner />
            <Trend />
            <New />
            <Upcoming />
            <TopCinemas />
          </>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default HomePage;
