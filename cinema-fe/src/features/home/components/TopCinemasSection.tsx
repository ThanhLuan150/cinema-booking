import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useTopCinemas } from '@/features/movies/hooks/useTopCinemas';
import { SectionHeading } from '@/components/common/SectionHeading';
import { getImageUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';

const TOP_CINEMAS_SIZE = 4;

const TopCinemas = () => {
  const { t } = useTranslation('home');
  const { data: cinemas = [] } = useTopCinemas();
  const visibleCinemas = cinemas.slice(0, TOP_CINEMAS_SIZE);

  if (visibleCinemas.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      <SectionHeading title={t('topCinemasSlider.title')} />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {visibleCinemas.map((cinema) => (
          <Link
            key={cinema.id}
            to={ROUTES.cinemaDetail(cinema.id)}
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface no-underline shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-raised"
          >
            <div className="aspect-[16/9] overflow-hidden bg-surface-raised">
              {cinema.images?.[0] ? (
                <img
                  src={getImageUrl(cinema.images[0])}
                  alt={cinema.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-main">
                  <i className="fa-solid fa-film text-4xl text-white/15" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-2 text-sm font-semibold text-white transition-colors group-hover:text-accent">
                {cinema.name}
              </h3>
              <p className="mt-2 line-clamp-2 text-xs text-txt/55">
                <i className="fa-solid fa-location-dot mr-1 text-accent" />
                {[cinema.address, cinema.city].filter(Boolean).join(', ') ||
                  t('topCinemasSlider.addressUpdating')}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-3 text-xs">
                <span className="flex items-center gap-1 font-medium text-gold">
                  <i className="fa-solid fa-star" />
                  {cinema.avgRating > 0 ? cinema.avgRating : t('topCinemasSlider.newRating')}
                </span>
                <span className="text-txt/45">
                  &middot; {cinema.bookingCount} {t('topCinemasSlider.ticketsBooked')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Link
          to={ROUTES.cinemas}
          className="inline-flex items-center gap-2 rounded-full border border-accent px-10 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent no-underline transition-all hover:bg-accent hover:text-white"
        >
          {t('movieTabs.viewMore')}
        </Link>
      </div>
    </section>
  );
};

export default TopCinemas;
