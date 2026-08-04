import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCinemasList } from '@/features/movies/hooks/useCinemasList';
import { ROUTES } from '@/constants/routes';

export interface CinemaMenuProps {
  /** Data is only fetched while the menu is open. */
  open: boolean;
  onNavigate: () => void;
}

/** Galaxy's "Rạp" menu: the full branch list in a scrollable column. */
export function CinemaMenu({ open, onNavigate }: CinemaMenuProps) {
  const { t } = useTranslation('common');
  const { data } = useCinemasList({ enabled: open });
  const cinemas = data?.data ?? [];

  const itemClass =
    'block rounded-md px-4 py-2.5 text-center text-sm text-txt/80 no-underline transition-colors hover:bg-white/5 hover:text-accent';

  return (
    <div className="w-64 rounded-b-xl border border-border-strong bg-surface-raised p-1.5 shadow-raised">
      <Link to={ROUTES.cinemas} onClick={onNavigate} className={itemClass}>
        {t('nav.allCinemas')}
      </Link>
      {cinemas.length > 0 && (
        <ul className="themed-scrollbar mt-1 max-h-80 overflow-y-auto border-t border-border pt-1">
          {cinemas.map((cinema) => (
            <li key={cinema.id}>
              <Link to={ROUTES.cinemaDetail(cinema.id)} onClick={onNavigate} className={itemClass}>
                {cinema.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
