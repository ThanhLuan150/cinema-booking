import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Like from '@/features/movies/components/Like';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { getMoviePosterUrl, getTrailerKind, getYoutubeEmbedUrl } from '@/utils';
import { useMovieReviews } from '../hooks/useMovieReviews';

const chipClass =
  'rounded-md border border-border-strong bg-surface-soft px-3 py-1.5 text-sm text-txt';

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
      <span className="w-32 shrink-0 pt-1.5 text-sm text-txt/55">{label}:</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const BannerDetail = () => {
  const { t, i18n } = useTranslation('movieDetail');
  const { id } = useParams<{ id: string }>();
  const { data: movie } = useMovieDetail(id);
  const { data: reviewData } = useMovieReviews(id);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);

  if (!movie) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  const trailerKind = getTrailerKind(movie.trailer);
  const average = reviewData?.average ?? 0;
  const reviewCount = reviewData?.count ?? 0;
  const releaseDate = movie.premiere_date
    ? new Intl.DateTimeFormat(i18n.language, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(movie.premiere_date))
    : t('bannerDetail.notAvailable');
  const actors = movie.actors || [];
  const directors = movie.directors || [];
  const categories = movie.categories || [];

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="relative -mt-10 w-[220px] shrink-0 self-center sm:-mt-12 sm:self-start md:w-[278px]">
          <img
            src={getMoviePosterUrl(movie.avatar)}
            alt={movie.name}
            className="aspect-[2/3] w-full rounded-xl object-cover shadow-raised ring-1 ring-border-strong"
          />
          {trailerKind && (
            <button
              type="button"
              onClick={() => setIsTrailerOpen(true)}
              aria-label={t('bannerDetail.watchTrailer')}
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-main/50 opacity-0 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl text-white shadow-glow">
                <i className="fa-solid fa-play" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight text-white md:text-3xl">{movie.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-txt/70">
            <span className="flex items-center gap-2">
              <i className="fa-regular fa-calendar text-accent" aria-hidden="true" />
              {releaseDate}
            </span>
          </div>

          {reviewCount > 0 && (
            <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-white">
              <i className="fa-solid fa-star text-gold" aria-hidden="true" />
              {average}
              <span className="text-sm font-normal text-txt/55">
                ({t('bannerDetail.voteCount', { count: reviewCount })})
              </span>
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3">
            {!!movie.duration && (
              <FactRow label={t('bannerDetail.duration')}>
                <span className="pt-1.5 text-sm text-txt">{t('bannerDetail.durationValue', { count: movie.duration })}</span>
              </FactRow>
            )}
            {movie.country && (
              <FactRow label={t('bannerDetail.country')}>
                <span className="pt-1.5 text-sm text-txt">{movie.country}</span>
              </FactRow>
            )}
            {movie.producer && (
              <FactRow label={t('bannerDetail.producer')}>
                <span className="pt-1.5 text-sm text-txt">{movie.producer}</span>
              </FactRow>
            )}
            {categories.length > 0 && (
              <FactRow label={t('bannerDetail.genre')}>
                {categories.map((cat) => (
                  <span key={cat.id} className={chipClass}>
                    {cat.name}
                  </span>
                ))}
              </FactRow>
            )}
            {directors.length > 0 && (
              <FactRow label={t('bannerDetail.director')}>
                {directors.map((director) => (
                  <span key={director.id} className={chipClass}>
                    {director.full_name}
                  </span>
                ))}
              </FactRow>
            )}
            {actors.length > 0 && (
              <FactRow label={t('bannerDetail.cast')}>
                {actors.map((actor) => (
                  <span key={actor.id} className={chipClass}>
                    {actor.full_name}
                    {actor.character_name ? ` (${actor.character_name})` : ''}
                  </span>
                ))}
              </FactRow>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <a
              href="#showtimes"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
            >
              <i className="fa-solid fa-ticket" />
              {t('bannerDetail.bookNow')}
            </a>
            {trailerKind && (
              <button
                type="button"
                onClick={() => setIsTrailerOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-6 py-3.5 text-sm font-semibold text-txt transition-all hover:border-accent hover:text-accent"
              >
                <i className="fa-regular fa-circle-play" />
                {t('bannerDetail.watchTrailer')}
              </button>
            )}
            <Like movieId={movie.id} />
          </div>
        </div>
      </div>

      {movie.description && (
        <div>
          <h2 className="mb-4 flex items-center gap-3 text-lg font-bold uppercase tracking-wide text-white">
            <span className="h-6 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t('bannerDetail.content')}
          </h2>
          <p className="whitespace-pre-line leading-relaxed text-txt/75">{movie.description}</p>
        </div>
      )}

      {isTrailerOpen && trailerKind && (
        <Modal open onClose={() => setIsTrailerOpen(false)} title={t('detailTrailer.title')}>
          {trailerKind === 'youtube' && (
            <div className="aspect-video w-full overflow-hidden rounded-xl">
              <iframe
                className="h-full w-full"
                src={getYoutubeEmbedUrl(movie.trailer)}
                title={`${movie.name} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
          {trailerKind === 'video' && (
            <video className="w-full rounded-xl" controls src={movie.trailer} />
          )}
          {trailerKind === 'image' && (
            <img
              className="w-full rounded-xl object-cover"
              src={movie.trailer}
              alt={`${movie.name} trailer`}
            />
          )}
        </Modal>
      )}
    </div>
  );
};

export default BannerDetail;
