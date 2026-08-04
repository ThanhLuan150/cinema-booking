import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import type { Movie } from '@/types/entities';

const MEGA_MENU_SIZE = 4;

export interface MovieMegaMenuProps {
  /** Data is only fetched while the menu is open. */
  open: boolean;
  onNavigate: () => void;
}

/** Galaxy's "Phim" menu: poster rows for what is playing now and what is coming next. */
export function MovieMegaMenu({ open, onNavigate }: MovieMegaMenuProps) {
  const { t } = useTranslation('common');
  const { data: playing } = useMovies(
    { status: 'playing' },
    { limit: MEGA_MENU_SIZE },
    { enabled: open },
  );
  const { data: upcoming } = useMovies(
    { status: 'upcoming' },
    { limit: MEGA_MENU_SIZE },
    { enabled: open },
  );

  const sections: { key: string; title: string; href: string; movies: Movie[] }[] = [
    { key: 'playing', title: t('nav.playing'), href: ROUTES.playing, movies: playing?.data ?? [] },
    {
      key: 'upcoming',
      title: t('nav.upcoming'),
      href: ROUTES.upcoming,
      movies: upcoming?.data ?? [],
    },
  ].filter((section) => section.movies.length > 0);

  if (sections.length === 0) return null;

  return (
    <div className="w-[900px] max-w-[92vw] rounded-b-xl border border-border-strong bg-surface-raised p-7 shadow-raised">
      <div className="flex flex-col gap-7">
        {sections.map((section) => (
          <div key={section.key}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-white">
                <span className="h-4 w-1 rounded-full bg-accent" aria-hidden="true" />
                {section.title}
              </h3>
              <Link
                to={section.href}
                onClick={onNavigate}
                className="whitespace-nowrap text-xs font-medium text-txt/55 no-underline transition-colors hover:text-accent"
              >
                {t('actions.viewAll')} <i className="fa-solid fa-arrow-right ml-1 text-[10px]" />
              </Link>
            </div>

            <div className="grid grid-cols-[repeat(4,minmax(0,150px))] gap-5">
              {section.movies.map((movie) => (
                <Link
                  key={movie.id}
                  to={ROUTES.movieDetail(movie.id)}
                  onClick={onNavigate}
                  className="group no-underline"
                >
                  <img
                    src={getMoviePosterUrl(movie.avatar)}
                    alt={movie.name}
                    loading="lazy"
                    className="aspect-[2/3] w-full rounded-lg object-cover shadow-card ring-1 ring-border transition-all group-hover:ring-accent/60"
                  />
                  <p className="mt-2 line-clamp-2 text-xs font-medium text-txt/85 transition-colors group-hover:text-accent">
                    {movie.name}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
