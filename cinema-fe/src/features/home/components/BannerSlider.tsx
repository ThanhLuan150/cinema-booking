import type { ReactNode } from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

interface ArrowProps {
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  direction: 'next' | 'prev';
  t: (key: string) => string;
}

function Arrow({ className, style, onClick, direction, t }: ArrowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`${className} !z-10 !flex !h-10 !w-10 !items-center !justify-center !rounded-full !bg-black/40 text-white transition-colors before:!content-none hover:!bg-accent`}
      aria-label={direction === 'next' ? t('bannerSlider.nextSlide') : t('bannerSlider.prevSlide')}
    >
      <i className={`fa-solid fa-chevron-${direction === 'next' ? 'right' : 'left'}`} />
    </button>
  );
}

const Banner = () => {
  const { t } = useTranslation('home');
  const { data } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const bannerMovies = (data?.data ?? []).slice(0, 5);

  const settings = {
    dots: true,
    infinite: bannerMovies.length > 4,
    autoplay: bannerMovies.length > 4,
    autoplaySpeed: 5000,
    speed: 600,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: bannerMovies.length > 1,
    nextArrow: <Arrow direction="next" t={t} />,
    prevArrow: <Arrow direction="prev" t={t} />,
    appendDots: (dots: ReactNode) => <ul className="!bottom-6 !flex !justify-center !gap-2">{dots}</ul>,
    customPaging: () => (
      <button
        type="button"
        aria-label={t('bannerSlider.goToSlide')}
        className="h-2 w-2 rounded-full bg-white/40 transition-all hover:bg-white/70"
      />
    ),
  };

  if (bannerMovies.length === 0) return null;

  return (
    <div className="banner-slider relative">
      <Slider {...settings}>
        {bannerMovies.map((movie) => (
          <div key={movie.id}>
            <div className="relative h-[70vh] min-h-[420px]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${getMoviePosterUrl(movie.avatar)})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-main via-main/70 to-main/20" />
              <div className="absolute inset-0 bg-gradient-to-r from-main/95 via-main/50 to-transparent" />
              <div className="relative z-[1] mx-auto flex h-full w-4/5 flex-col justify-center">
                <div className="max-w-xl">
                  {(movie.categories || []).length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {movie.categories!.slice(0, MAX_VISIBLE_CATEGORIES).map((cat) => (
                        <span
                          key={cat.id}
                          className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <h1 className="text-4xl font-bold text-white sm:text-5xl">{movie.name}</h1>
                  <p className="mt-4 line-clamp-3 text-sm text-txt/80 sm:text-base">{movie.description}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href={ROUTES.movieDetail(movie.id)}
                      className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-transparent hover:border-white/30 hover:text-accent"
                    >
                      <i className="fa-solid fa-ticket mr-2" />
                      {t('bannerSlider.bookNow')}
                    </a>
                    <a
                      href={ROUTES.movieDetail(movie.id)}
                      className="rounded-md border border-white/30 px-6 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-white/10"
                    >
                      {t('bannerSlider.viewDetails')}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default Banner;
