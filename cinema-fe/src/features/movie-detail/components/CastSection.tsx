import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
import { getImageUrl } from '@/utils';

const CastSection = () => {
  const { t } = useTranslation('movieDetail');
  const { id } = useParams<{ id: string }>();
  const { data: movie } = useMovieDetail(id);

  if (!movie) return null;

  const cast = movie.cast || [];
  if (!movie.producer && !movie.director && cast.length === 0) return null;

  return (
    <div className="mx-auto w-4/5 py-8">
      {movie.director && (
        <p className="text-sm text-txt/80">
          <span className="font-semibold text-white">{t('castSection.director')}</span> {movie.director}
        </p>
      )}
      {movie.producer && (
        <p className="mt-1 text-sm text-txt/80">
          <span className="font-semibold text-white">{t('castSection.producer')}</span> {movie.producer}
        </p>
      )}

      {cast.length > 0 && (
        <>
          <h5 className="mb-4 mt-6 text-left text-2xl text-white">{t('castSection.cast')}</h5>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cast.map((member, index) => (
              <div key={index} className="text-center">
                {member.avatar ? (
                  <img
                    src={getImageUrl(member.avatar)}
                    alt={member.name}
                    className="mx-auto h-24 w-24 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl font-semibold text-white/40">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="mt-2 truncate text-sm font-medium text-white">{member.name}</p>
                {member.role && <p className="truncate text-xs text-txt/60">{member.role}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default CastSection;
