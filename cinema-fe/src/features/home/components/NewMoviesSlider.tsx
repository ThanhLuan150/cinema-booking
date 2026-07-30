import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { EmptyState } from '@/components/feedback/EmptyState';
import { getMoviePosterUrl } from '@/utils';
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
      {
        breakpoint: 1200,
        settings: {
          slidesToShow: 3,
        },
      },
      {
        breakpoint: 992,
        settings: {
          slidesToShow: 2,
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
      <div className="mt-8">
        <h5 className="text-left text-2xl pb-10 text-white">{t('newMoviesSlider.title')}</h5>
      </div>
      {newMovies.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <Slider {...settings}>
          {newMovies.map((movie) => (
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
                  <span className="mt-2 text-xs font-medium text-white/80">{t('newMoviesSlider.viewDetails')} →</span>
                </div>
              </a>
            </div>
          ))}
        </Slider>
      )}
    </div>
  );
};

export default New;
