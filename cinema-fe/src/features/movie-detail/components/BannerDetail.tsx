import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Like from '@/features/movies/components/Like';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { Spinner } from '@/components/ui/Spinner';
import { getMoviePosterUrl } from '@/utils';
import { ROUTES } from '@/constants/routes';

const BannerDetail = () => {
  const { t } = useTranslation('movieDetail');
  const { id } = useParams<{ id: string }>();
  const { data: movie } = useMovieDetail(id);

  if (!movie) {
    return (
      <div className="flex justify-center bg-gradient-to-b from-surface-raised to-main py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-b from-surface-raised to-main">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 blur-2xl"
        style={{ backgroundImage: `url(${getMoviePosterUrl(movie.avatar)})` }}
        aria-hidden="true"
      />
      <div className="relative w-full px-6 py-16 md:px-10 md:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row">
          <img
            src={getMoviePosterUrl(movie.avatar)}
            alt={movie.name}
            className="h-[420px] w-[280px] shrink-0 self-center rounded-xl border-2 border-accent/60 object-cover shadow-raised md:self-start"
          />
          <div className="flex-1 text-white">
            <h1 className="text-2xl font-bold md:text-3xl">{movie.name}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-medium text-gold">
                <i className="fa-solid fa-star" /> 7.4
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-white/5 px-3 py-1">
                <i className="fa-solid fa-calendar-days text-accent" /> {movie.premiere_date}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-white/5 px-3 py-1">
                <i className="fa-solid fa-globe text-accent" /> {movie.country || t('bannerDetail.notAvailable')}
              </span>
            </div>

            <p className="mt-6 max-w-2xl leading-relaxed text-white/75">{movie.description}</p>

            {(movie.categories || []).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {movie.categories!.map((cat) => (
                  <span key={cat.id} className="rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
                    {cat.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={ROUTES.bookTicket(movie.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
              >
                <i className="fa-solid fa-ticket" />
                {t('bannerDetail.bookNow')}
              </Link>
              <Like movieId={movie.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerDetail;
