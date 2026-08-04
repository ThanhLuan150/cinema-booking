import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMovies } from '@/features/movies/hooks/useMovies';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

const SIDEBAR_SIZE = 6;

/** The "PHIM ĐANG CHIẾU" rail Galaxy keeps beside the movie details. */
const NowShowingSidebar = () => {
  const { t } = useTranslation('movieDetail');
  const { id } = useParams<{ id: string }>();
  const { data } = useMovies({ status: 'playing' }, { limit: FULL_LIST_FETCH_LIMIT });

  const movies = (data?.data ?? [])
    .filter((movie) => String(movie.id) !== String(id))
    .slice(0, SIDEBAR_SIZE);
  if (movies.length === 0) return null;

  return (
    <div className="lg:sticky lg:top-24">
      <h2 className="mb-5 flex items-center gap-3 text-lg font-bold uppercase tracking-wide text-white">
        <span className="h-6 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('nowShowing.title')}
      </h2>

      <ul className="flex flex-col gap-4">
        {movies.map((movie) => (
          <li key={movie.id}>
            <Link
              to={ROUTES.movieDetail(movie.id)}
              className="group flex gap-3 rounded-xl border border-border bg-surface p-3 no-underline shadow-card transition-all hover:border-accent/40 hover:shadow-raised"
            >
              <img
                src={getMoviePosterUrl(movie.avatar)}
                alt={movie.name}
                loading="lazy"
                className="aspect-[2/3] w-[68px] shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 text-sm font-semibold text-white transition-colors group-hover:text-accent">
                  {movie.name}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-xs text-txt/55">
                  {(movie.categories || [])
                    .slice(0, MAX_VISIBLE_CATEGORIES)
                    .map((cat) => cat.name)
                    .join(', ')}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent">
                  {t('nowShowing.buyTicket')}
                  <i className="fa-solid fa-arrow-right text-[10px]" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NowShowingSidebar;
