import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { EmptyState } from '@/components/feedback/EmptyState';
import { getMoviePosterUrl } from '@/utils';
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
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 1,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 1,
        },
      },
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  return (
    <div className="mx-auto w-4/5 pt-8 pb-8 text-center">
      <div>
        <h5 className="text-left text-2xl pb-10 text-white">{t('upcomingMoviesSlider.title')}</h5>
      </div>
      {upcomingMovies.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <Slider {...settings}>
          {upcomingMovies.map((movie) => (
            <div key={movie.id} className="px-3">
              <a
                href={ROUTES.movieDetail(movie.id)}
                className="group relative block overflow-hidden rounded-xl no-underline shadow-lg shadow-black/40"
              >
                <img
                  src={getMoviePosterUrl(movie.avatar)}
                  alt={movie.name}
                  className="h-[220px] w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/95 via-black/40 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <h6 className="truncate text-base font-semibold text-white">{movie.name}</h6>
                  <p className="mt-1 truncate text-xs text-accent">
                    {(movie.categories || []).map((cat) => cat.name).join(' / ')}
                  </p>
                  <span className="mt-2 text-xs font-medium text-white/80">{t('upcomingMoviesSlider.viewDetails')} →</span>
                </div>
              </a>
            </div>
          ))}
        </Slider>
      )}
    </div>
  );
};

export default Upcoming;
