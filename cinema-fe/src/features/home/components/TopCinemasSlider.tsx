import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTopCinemas } from '@/features/movies/hooks/useTopCinemas';
import { SectionHeading } from '@/components/common/SectionHeading';
import { getImageUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';

const TopCinemas = () => {
  const { t } = useTranslation('home');
  const { data: cinemas = [] } = useTopCinemas();

  const settings = {
    dots: false,
    infinite: cinemas.length > 4,
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

  if (cinemas.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-8 md:px-10">
      <SectionHeading title={t('topCinemasSlider.title')} viewAllHref={ROUTES.cinemas} />
      <Slider {...settings}>
        {cinemas.map((cinema) => (
          <div key={cinema.id} className="px-2.5">
            <Link
              to={ROUTES.cinemaDetail(cinema.id)}
              className="group relative block aspect-[4/3] overflow-hidden rounded-xl bg-surface no-underline shadow-card ring-1 ring-border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-raised hover:ring-accent/50"
            >
              {cinema.images?.[0] ? (
                <img
                  src={getImageUrl(cinema.images[0])}
                  alt={cinema.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-main">
                  <i className="fa-solid fa-film text-5xl text-white/15" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-left">
                <h6 className="truncate text-base font-semibold text-white">{cinema.name}</h6>
                <p className="mt-1 truncate text-xs text-txt/70">
                  <i className="fa-solid fa-location-dot mr-1 text-accent" />
                  {[cinema.address, cinema.city].filter(Boolean).join(', ') ||
                    t('topCinemasSlider.addressUpdating')}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 font-medium text-gold">
                    <i className="fa-solid fa-star" />
                    {cinema.avgRating > 0 ? cinema.avgRating : t('topCinemasSlider.newRating')}
                  </span>
                  <span className="text-white/50">
                    &middot; {cinema.bookingCount} {t('topCinemasSlider.ticketsBooked')}
                  </span>
                </div>
              </div>
            </Link>
          </div>
        ))}
      </Slider>
    </section>
  );
};

export default TopCinemas;
