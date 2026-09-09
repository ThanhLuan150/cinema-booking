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
  label: string;
}

// react-slick's default arrows lean on `slick-theme.css` (font-size:0 on the button + a `:before`
// glyph in a bundled icon font). That collapses any child `<i>` to nothing, so we suppress the
// pseudo-element and draw an inline SVG chevron that renders regardless of font sizing.
function Arrow({ className, style, onClick, direction, label }: ArrowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      aria-label={label}
      className={`${className ?? ''} !z-20 !flex !h-11 !w-11 !items-center !justify-center !rounded-full !border !border-white/25 !bg-main/60 !text-white !opacity-100 !backdrop-blur-md !transition-colors before:!hidden hover:!border-accent hover:!bg-accent ${
        direction === 'next' ? '!right-3 lg:!right-6' : '!left-3 lg:!left-6'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points={direction === 'next' ? '9 6 15 12 9 18' : '15 6 9 12 15 18'} />
      </svg>
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
    arrows: bannerMovies.length > 1,
    nextArrow: <Arrow direction="next" label={t('bannerSlider.nextSlide')} />,
    prevArrow: <Arrow direction="prev" label={t('bannerSlider.prevSlide')} />,
    responsive: [{ breakpoint: 768, settings: { arrows: false } }],
    // Lifted clear of the QuickBooking bar, which straddles the hero's bottom edge on lg (-mt-8).
    dotsClass: 'slick-dots !absolute !bottom-6 !flex !justify-center !gap-2.5 lg:!bottom-16',
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
    <section className="bg-main">
      <div className="banner-slider relative [&_.slick-dots_li.slick-active_button]:!w-6 [&_.slick-dots_li.slick-active_button]:!bg-accent [&_.slick-dots_li]:!m-0 [&_.slick-dots_li]:!h-2 [&_.slick-dots_li]:!w-auto [&_.slick-slide.slick-active]:opacity-100 [&_.slick-slide]:transition-opacity [&_.slick-slide]:duration-500">
        <Slider {...settings}>
          {bannerMovies.map((movie) => {
            const isWide = !!movie.banner;
            const backdrop = movie.banner || getMoviePosterUrl(movie.avatar);
            const year = movie.premiere_date?.slice(0, 4);
            return (
              <div key={movie.id}>
                {/* Full-bleed hero — the artwork spans the whole viewport width. A real <img>
                    stays crisp; the portrait fallback gets a faint blur so its heavy crop isn't
                    jarring. */}
                <div className="relative h-[62vh] min-h-[460px] w-full overflow-hidden lg:h-[74vh] lg:min-h-[560px]">
                  <img
                    src={backdrop}
                    alt=""
                    aria-hidden="true"
                    className={`absolute inset-0 h-full w-full object-cover object-center ${
                      isWide ? '' : 'scale-105 blur-sm'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-main via-main/75 to-main/10" />
                  <div className="absolute inset-0 bg-gradient-to-t from-main/95 via-transparent to-main/25" />

                  <div className="relative z-[1] mx-auto flex h-full max-w-7xl flex-col justify-center gap-4 px-10 sm:px-16 lg:px-20">
                    <div className="max-w-2xl">
                      {(movie.categories || []).length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2 animate-slide-up">
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
                      <h1 className="line-clamp-2 text-3xl font-bold leading-tight text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
                        {movie.name}
                      </h1>

                      {(year || movie.duration || movie.age_rating) && (
                        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-txt/75">
                          {year && <span>{year}</span>}
                          {!!movie.duration && (
                            <span className="flex items-center gap-1.5">
                              <i className="fa-regular fa-clock text-accent" aria-hidden="true" />
                              {t('bannerSlider.durationValue', { count: movie.duration })}
                            </span>
                          )}
                          {movie.age_rating && (
                            <span className="rounded border border-white/30 px-1.5 py-0.5 text-xs font-bold uppercase text-white/90">
                              {movie.age_rating}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-txt/80 sm:text-base">
                        {movie.description}
                      </p>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                          to={ROUTES.bookTicket(movie.id)}
                          className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
                        >
                          <i className="fa-solid fa-ticket" />
                          {t('bannerSlider.bookNow')}
                        </Link>
                        <Link
                          to={ROUTES.movieDetail(movie.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white no-underline backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/10"
                        >
                          <i className="fa-regular fa-circle-play" />
                          {t('bannerSlider.viewDetails')}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Slider>
      </div>
    </section>
  );
};

export default Banner;
