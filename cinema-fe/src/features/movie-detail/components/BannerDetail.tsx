import { useParams } from 'react-router-dom';
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
      <div className="flex justify-center bg-gradient-to-b from-[#0B1A2A] to-main py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-[#0B1A2A] to-main">
      <div className="w-full px-6 py-16 md:px-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row">
          <img
            src={getMoviePosterUrl(movie.avatar)}
            alt={movie.name}
            className="h-[420px] w-[280px] shrink-0 self-center rounded-lg border-2 border-accent object-cover shadow-2xl shadow-black md:self-start"
          />
          <div className="flex-1 text-white">
            <h1 className="text-3xl font-bold md:text-4xl">{movie.name}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1">
                <i className="fa-solid fa-star text-accent" /> 7.4
              </span>
              <span className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1">
                <i className="fa-solid fa-calendar-days text-accent" /> {movie.premiere_date}
              </span>
              <span className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1">
                <i className="fa-solid fa-globe text-accent" /> {movie.country || t('bannerDetail.notAvailable')}
              </span>
            </div>

            <p className="mt-6 max-w-2xl leading-relaxed text-white/80">{movie.description}</p>

            {(movie.categories || []).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {movie.categories!.map((cat) => (
                  <span key={cat.id} className="rounded bg-accent/20 px-3 py-1 text-xs text-accent">
                    {cat.name}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-8 flex items-center gap-4">
              <a
                href={ROUTES.bookTicket(movie.id)}
                className="rounded-md bg-accent px-6 py-2.5 font-medium text-white no-underline transition-colors hover:bg-white hover:text-accent"
              >
                {t('bannerDetail.bookNow')}
              </a>
              <Like movieId={movie.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannerDetail;
