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
      className={`${className} !z-10 !flex !h-11 !w-11 !items-center !justify-center !rounded-full !border !border-white/15 !bg-black/50 text-white backdrop-blur-md transition-colors before:!content-none hover:!border-accent hover:!bg-accent ${
        direction === 'next' ? '!right-2 md:!right-[7%]' : '!left-2 md:!left-[7%]'
      }`}
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
    infinite: bannerMovies.length > 1,
    autoplay: bannerMovies.length > 1,
    autoplaySpeed: 6000,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    centerMode: true,
    centerPadding: '8%',
    arrows: bannerMovies.length > 1,
    nextArrow: <Arrow direction="next" t={t} />,
    prevArrow: <Arrow direction="prev" t={t} />,
    // Arrows sit on top of the copy below desktop widths, so swipe is the only control there.
    responsive: [
      { breakpoint: 1024, settings: { arrows: false, centerMode: true, centerPadding: '4%' } },
      { breakpoint: 768, settings: { arrows: false, centerMode: false, centerPadding: '0px' } },
    ],
    dotsClass: 'slick-dots !absolute !bottom-3 !flex !justify-center !gap-2.5 md:!bottom-14',
    appendDots: (dots: ReactNode) => <ul>{dots}</ul>,
    customPaging: () => (
      <button
        type="button"
        aria-label={t('bannerSlider.goToSlide')}
        className="!h-2 !w-2 !rounded-full !bg-white/40 !p-0 transition-all before:!content-none hover:!bg-white/80"
      />
    ),
  };

  if (bannerMovies.length === 0) return null;

  return (
    <section className="bg-main pt-6">
      <div className="mx-auto w-full max-w-[1900px] px-2 md:px-6">
        <div className="banner-slider relative [&_.slick-dots_li.slick-active_button]:!w-6 [&_.slick-dots_li.slick-active_button]:!bg-accent [&_.slick-dots_li]:!m-0 [&_.slick-dots_li]:!h-2 [&_.slick-dots_li]:!w-auto [&_.slick-slide.slick-active]:opacity-100 [&_.slick-slide]:opacity-40 [&_.slick-slide]:transition-opacity [&_.slick-slide]:duration-500">
          <Slider {...settings}>
            {bannerMovies.map((movie) => (
              <div key={movie.id}>
                <div className="px-1.5 md:px-3">
                  <div className="relative aspect-[4/3] min-h-[360px] overflow-hidden rounded-2xl border border-border sm:aspect-[16/9] lg:aspect-[21/9]">
                    <div
                      className="absolute inset-0 scale-110 bg-cover bg-center blur-xl"
                      style={{ backgroundImage: `url(${getMoviePosterUrl(movie.avatar)})` }}
                      aria-hidden="true"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-main via-main/85 to-main/40" />

                    <div className="relative z-[1] flex h-full items-center gap-6 px-5 py-6 pb-12 sm:px-10 md:gap-10 md:pb-6">
                      <div className="max-w-xl flex-1 animate-slide-up">
                        {(movie.categories || []).length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {movie.categories!.slice(0, MAX_VISIBLE_CATEGORIES).map((cat) => (
                              <span
                                key={cat.id}
                                className="rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-accent"
                              >
                                {cat.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <h1 className="line-clamp-2 text-2xl font-bold leading-tight text-white drop-shadow-lg sm:text-3xl lg:text-4xl">
                          {movie.name}
                        </h1>
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-txt/75 sm:mt-4 sm:line-clamp-3">
                          {movie.description}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-3 sm:mt-7">
                          <Link
                            to={ROUTES.bookTicket(movie.id)}
                            className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold uppercase tracking-wide text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
                          >
                            <i className="fa-solid fa-ticket" />
                            {t('bannerSlider.bookNow')}
                          </Link>
                          <Link
                            to={ROUTES.movieDetail(movie.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-5 py-3 text-sm font-semibold text-white no-underline backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/10"
                          >
                            <i className="fa-regular fa-circle-play" />
                            {t('bannerSlider.viewDetails')}
                          </Link>
                        </div>
                      </div>

                      <Link
                        to={ROUTES.movieDetail(movie.id)}
                        className="hidden aspect-[2/3] h-full shrink-0 overflow-hidden rounded-xl shadow-raised ring-1 ring-white/10 transition-transform duration-300 hover:scale-[1.03] md:block"
                      >
                        <img
                          src={getMoviePosterUrl(movie.avatar)}
                          alt={movie.name}
                          className="h-full w-full object-cover"
                        />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </section>
  );
};

export default Banner;
