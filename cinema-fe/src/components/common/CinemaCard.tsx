import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';

export interface CinemaCardCinema {
  id: number | string;
  name: string;
  address?: string | null;
  city?: string | null;
  images?: string[];
}

export interface CinemaCardProps {
  cinema: CinemaCardCinema;
}

export function CinemaCard({ cinema }: CinemaCardProps) {
  const { t } = useTranslation('movies');

  return (
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-left">
        <h6 className="truncate text-base font-semibold text-white">{cinema.name}</h6>
        <p className="mt-1 truncate text-xs text-txt/70">
          <i className="fa-solid fa-location-dot mr-1 text-accent" />
          {[cinema.address, cinema.city].filter(Boolean).join(', ') || t('cinemas.addressUpdating')}
        </p>
        <span className="mt-2 flex items-center gap-1 text-xs font-medium text-accent">
          {t('cinemas.viewDetails')} <i className="fa-solid fa-arrow-right text-[10px]" />
        </span>
      </div>
    </Link>
  );
}
