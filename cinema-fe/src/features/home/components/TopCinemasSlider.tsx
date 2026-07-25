import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { useTranslation } from 'react-i18next';
import { useTopCinemas } from '@/features/movies/hooks/useTopCinemas';
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

  if (cinemas.length === 0) return null;

  return (
    <div className="mx-auto w-4/5 pt-8 pb-8 text-center">
      <div>
        <h5 className="text-left text-2xl pb-10 text-white">{t('topCinemasSlider.title')}</h5>
      </div>
      <Slider {...settings}>
        {cinemas.map((cinema) => (
          <div key={cinema.id} className="px-3">
            <a
              href={ROUTES.cinemaDetail(cinema.id)}
              className="group relative block overflow-hidden rounded-xl no-underline shadow-lg shadow-black/40"
            >
              {cinema.images?.[0] ? (
                <img
                  src={getImageUrl(cinema.images[0])}
                  alt={cinema.name}
                  className="h-[220px] w-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-[220px] w-full items-center justify-center bg-gradient-to-br from-[#1A293C] to-main">
                  <i className="fa-solid fa-film text-5xl text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
              <div className="absolute inset-0 flex flex-col justify-end p-4 text-left">
                <h6 className="truncate text-base font-semibold text-white">{cinema.name}</h6>
                <p className="mt-1 truncate text-xs text-txt/70">
                  <i className="fa-solid fa-location-dot mr-1 text-accent" />
                  {[cinema.address, cinema.city].filter(Boolean).join(', ') || t('topCinemasSlider.addressUpdating')}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="flex items-center gap-1 font-medium text-amber-400">
                    <i className="fa-solid fa-star" />
                    {cinema.avgRating > 0 ? cinema.avgRating : t('topCinemasSlider.newRating')}
                  </span>
                  <span className="text-white/50">
                    · {cinema.bookingCount} {t('topCinemasSlider.ticketsBooked')}
                  </span>
                </div>
              </div>
            </a>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default TopCinemas;
