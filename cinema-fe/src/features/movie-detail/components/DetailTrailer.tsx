import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { getTrailerKind, getYoutubeEmbedUrl } from '@/utils';

const DetailTrailer = () => {
  const { t } = useTranslation('movieDetail');
  const { id } = useParams<{ id: string }>();
  const { data: movie } = useMovieDetail(id);

  const kind = getTrailerKind(movie?.trailer);
  if (!movie || !kind) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-10">
      <h2 className="mb-5 flex items-center gap-3 text-xl font-bold text-white">
        <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        {t('detailTrailer.title')}
      </h2>
      {kind === 'youtube' && (
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-border shadow-raised">
          <iframe
            className="h-full w-full"
            src={getYoutubeEmbedUrl(movie.trailer)}
            title={`${movie.name} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {kind === 'video' && (
        <video className="w-full rounded-xl border border-border shadow-raised" controls src={movie.trailer} />
      )}
      {kind === 'image' && (
        <img
          className="w-full rounded-xl border border-border object-cover shadow-raised"
          src={movie.trailer}
          alt={`${movie.name} trailer`}
        />
      )}
    </div>
  );
};

export default DetailTrailer;
