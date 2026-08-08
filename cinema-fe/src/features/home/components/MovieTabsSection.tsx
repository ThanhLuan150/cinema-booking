import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { EmptyState } from '@/components/feedback/EmptyState';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MovieCard } from '@/components/common/MovieCard';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/constants/routes';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const HOME_GRID_SIZE = 8;

type MovieTab = 'playing' | 'new' | 'upcoming';

const MovieTabsSection = () => {
  const { t } = useTranslation('home');
  const [tab, setTab] = useState<MovieTab>('playing');
  const { data } = useMovies(undefined, { limit: FULL_LIST_FETCH_LIMIT });
  const movies = data?.data ?? [];

  const today = new Date().toISOString().split('T')[0];
  const byTab: Record<MovieTab, typeof movies> = {
    playing: movies
      .filter((movie) => movie.premiere_date <= today)
      .sort((a, b) => (a.premiere_date < b.premiere_date ? 1 : -1)),
    new: [...movies].sort(
      (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
    ),
    upcoming: movies
      .filter((movie) => movie.premiere_date > today)
      .sort((a, b) => (a.premiere_date > b.premiere_date ? 1 : -1)),
  };
  const visibleMovies = byTab[tab].slice(0, HOME_GRID_SIZE);

  const tabs: { key: MovieTab; label: string }[] = [
    { key: 'playing', label: t('movieTabs.playing') },
    { key: 'new', label: t('movieTabs.new') },
    { key: 'upcoming', label: t('movieTabs.upcoming') },
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      <SectionHeading title={t('movieTabs.title')}>
        <div role="tablist" className="flex flex-wrap items-center gap-x-6 gap-y-2 sm:gap-x-8">
          {tabs.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={cn(
                'relative pb-1.5 text-sm font-semibold transition-colors sm:text-base',
                'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent after:transition-transform',
                tab === item.key
                  ? 'text-accent after:scale-x-100'
                  : 'text-txt/55 after:scale-x-0 hover:text-txt',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </SectionHeading>

      {visibleMovies.length === 0 ? (
        <EmptyState title={t('empty')} icon="fa-solid fa-clapperboard" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {visibleMovies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} ctaLabel={t('movieTabs.viewDetails')} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link
              to={tab === 'upcoming' ? ROUTES.upcoming : ROUTES.playing}
              className="inline-flex items-center gap-2 rounded-full border border-accent px-10 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent no-underline transition-all hover:bg-accent hover:text-white"
            >
              {t('movieTabs.viewMore')}
            </Link>
          </div>
        </>
      )}
    </section>
  );
};

export default MovieTabsSection;
