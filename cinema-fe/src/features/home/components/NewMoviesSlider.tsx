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

const New = () => {
  const { t } = useTranslation('home');
  const { data } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const movies = data?.data ?? [];

  const newMovies = [...movies]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 5);

  const settings = {
    dots: false,
    infinite: newMovies.length > 4,
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
      <SectionHeading title={t('newMoviesSlider.title')} viewAllHref={ROUTES.playing} />
      {newMovies.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <Slider {...settings}>
          {newMovies.map((movie) => (
            <div key={movie.id} className="px-2.5">
              <MovieCard movie={movie} ctaLabel={t('newMoviesSlider.viewDetails')} />
            </div>
          ))}
        </Slider>
      )}
    </section>
  );
};

export default New;
