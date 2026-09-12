import { Spinner } from '@/components/ui/Spinner';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import Banner from './BannerSlider';
import QuickBooking from './QuickBooking';
import FeaturedMovies from './FeaturedMoviesSection';
import MovieTabs from './MovieTabsSection';
import TopCinemas from './TopCinemasSection';
import CampaignStrip from './CampaignStrip';

export default function HomeContent() {
  const { isLoading } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });

  if (isLoading) {
    return (
      <div className="flex min-h-[70vh] w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <Banner />
      <QuickBooking />
      <div className="divide-y divide-border">
        <CampaignStrip />
        <FeaturedMovies />
        <MovieTabs />
        <TopCinemas />
      </div>
    </>
  );
}
