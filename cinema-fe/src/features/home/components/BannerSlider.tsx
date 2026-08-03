import type { ReactNode } from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
      className={`${className} !z-10 !flex !h-11 !w-11 !items-center !justify-center !rounded-full !border !border-white/15 !bg-black/40 text-white backdrop-blur-md transition-colors before:!content-none hover:!bg-accent hover:!border-accent ${direction === 'next' ? '!right-4' : '!left-4'}`}
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
    autoplaySpeed: 6000,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    arrows: bannerMovies.length > 1,
    nextArrow: <Arrow direction="next" t={t} />,
    prevArrow: <Arrow direction="prev" t={t} />,
    appendDots: (dots: ReactNode) => <ul className="!bottom-8 !flex !justify-center !gap-2.5">{dots}</ul>,
    customPaging: () => (
      <button
        type="button"
        aria-label={t('bannerSlider.goToSlide')}
        className="h-1.5 w-6 rounded-full bg-white/30 transition-all hover:bg-white/60"
      />
    ),
  };

  if (bannerMovies.length === 0) return null;

  return (
    <div className="banner-slider relative [&_.slick-dots_li.slick-active_button]:!bg-accent [&_.slick-dots_li.slick-active_button]:!w-9">
      <Slider {...settings}>
        {bannerMovies.map((movie) => (
          <div key={movie.id}>
            <div className="relative h-[78vh] min-h-[480px] max-h-[820px]">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${getMoviePosterUrl(movie.avatar)})` }}
              />
              <div className="absolute inset-0 bg-hero-fade" />
              <div className="absolute inset-0 bg-gradient-to-r from-main/95 via-main/40 to-transparent" />
              <div className="relative z-[1] mx-auto flex h-full w-full max-w-7xl flex-col justify-center px-6 md:px-10">
                <div className="max-w-xl animate-slide-up">
                  {(movie.categories || []).length > 0 && (
                    <div className="mb-4 flex flex-wrap gap-2">
                      {movie.categories!.slice(0, MAX_VISIBLE_CATEGORIES).map((cat) => (
                        <span
                          key={cat.id}
                          className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent"
                        >
                          {cat.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <h1 className="text-3xl font-bold leading-tight text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
                    {movie.name}
                  </h1>
                  <p className="mt-5 line-clamp-3 text-sm leading-relaxed text-txt/80 sm:text-base">
                    {movie.description}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                      to={ROUTES.bookTicket(movie.id)}
                      className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
                    >
                      <i className="fa-solid fa-ticket" />
                      {t('bannerSlider.bookNow')}
                    </Link>
                    <Link
                      to={ROUTES.movieDetail(movie.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white no-underline backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/10"
                    >
                      <i className="fa-regular fa-circle-play" />
                      {t('bannerSlider.viewDetails')}
                    </Link>
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
