import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCinemasList } from '@/features/movies/hooks/useCinemasList';
import { getImageUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';

const MEGA_MENU_SIZE = 8;

export interface CinemaMenuProps {
  /** Data is only fetched while the menu is open. */
  open: boolean;
  onNavigate: () => void;
}

/** "Branches" mega menu — mirrors MovieMegaMenu: a card grid of branches with artwork. */
export function CinemaMenu({ open, onNavigate }: CinemaMenuProps) {
  const { t } = useTranslation('common');
  const { data } = useCinemasList({ enabled: open });
  const cinemas = (data?.data ?? []).slice(0, MEGA_MENU_SIZE);

  if (cinemas.length === 0) return null;

  return (
    <div className="w-[900px] max-w-[92vw] rounded-b-xl border border-border-strong bg-surface-raised p-7 shadow-raised">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-white">
          <span className="h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
          {t('nav.cinemas')}
        </h3>
        <Link
          to={ROUTES.cinemas}
          onClick={onNavigate}
          className="whitespace-nowrap text-xs font-medium text-txt/55 no-underline transition-colors hover:text-accent"
        >
          {t('nav.allCinemas')} <i className="fa-solid fa-arrow-right ml-1 text-[10px]" />
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-5">
        {cinemas.map((cinema) => (
          <Link
            key={cinema.id}
            to={ROUTES.cinemaDetail(cinema.id)}
            onClick={onNavigate}
            className="group no-underline"
          >
            <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-surface shadow-card ring-1 ring-border transition-all group-hover:ring-accent/60">
              {cinema.images?.[0] ? (
                <img
                  src={getImageUrl(cinema.images[0])}
                  alt={cinema.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-raised to-main">
                  <i className="fa-solid fa-clapperboard text-3xl text-white/15" aria-hidden="true" />
                </div>
              )}
            </div>
            <p className="mt-2 line-clamp-1 text-xs font-semibold text-txt/85 transition-colors group-hover:text-accent">
              {cinema.name}
            </p>
            <p className="mt-0.5 line-clamp-1 text-[11px] text-txt/50">
              <i className="fa-solid fa-location-dot mr-1 text-accent" aria-hidden="true" />
              {[cinema.address, cinema.city].filter(Boolean).join(', ') || '—'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
