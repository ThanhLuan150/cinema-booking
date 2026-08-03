import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MovieCard } from '@/components/common/MovieCard';
import { ROUTES } from '@/constants/routes';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const Upcoming = () => {
  const { t } = useTranslation('home');
  const { data } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const movies = data?.data ?? [];

  const today = new Date().toISOString().split('T')[0];
  const upcomingMovies = movies
    .filter((movie) => movie.premiere_date > today)
    .sort((a, b) => (a.premiere_date > b.premiere_date ? 1 : -1))
    .slice(0, 8);

  const settings = {
    dots: false,
    infinite: upcomingMovies.length > 4,
    speed: 500,
    slidesToShow: 4,
    slidesToScroll: 1,
    responsive: [
      { breakpoint: 1200, settings: { slidesToShow: 3 } },
      { breakpoint: 992, settings: { slidesToShow: 2 } },
      { breakpoint: 768, settings: { slidesToShow: 2 } },
      { breakpoint: 560, settings: { slidesToShow: 1 } },
    ],
  };

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10">
      <SectionHeading title={t('upcomingMoviesSlider.title')} viewAllHref={ROUTES.upcoming} />
      {upcomingMovies.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <Slider {...settings}>
          {upcomingMovies.map((movie) => (
            <div key={movie.id} className="px-2.5">
              <MovieCard movie={movie} ctaLabel={t('upcomingMoviesSlider.viewDetails')} />
            </div>
          ))}
        </Slider>
      )}
    </section>
  );
};

export default Upcoming;
