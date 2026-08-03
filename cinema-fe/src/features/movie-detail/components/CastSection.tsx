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
  const crew = [
    ...(movie.director ? [{ name: movie.director, avatar: movie.directorAvatar, label: t('castSection.director') }] : []),
    ...(movie.producer ? [{ name: movie.producer, avatar: movie.producerAvatar, label: t('castSection.producer') }] : []),
  ];
  if (crew.length === 0 && cast.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-10 md:px-10">
      {crew.length > 0 && (
        <>
          <h2 className="mb-5 flex items-center gap-3 text-xl font-bold text-white">
            <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t('castSection.crew')}
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {crew.map((person, index) => (
              <div key={index} className="text-center">
                {person.avatar ? (
                  <img
                    src={getImageUrl(person.avatar)}
                    alt={person.name}
                    className="mx-auto h-24 w-24 rounded-full border-2 border-border-strong object-cover shadow-card"
                  />
                ) : (
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-border-strong bg-accent-gradient text-2xl font-semibold text-white">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <p className="mt-2.5 truncate text-sm font-medium text-white">{person.name}</p>
                <p className="truncate text-xs text-txt/60">{person.label}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {cast.length > 0 && (
        <>
          <h2 className="mb-5 mt-8 flex items-center gap-3 text-xl font-bold text-white">
            <span className="h-5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t('castSection.cast')}
          </h2>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {cast.map((member, index) => (
              <div key={index} className="text-center">
                <div className="relative mx-auto h-24 w-24">
                  {member.avatar ? (
                    <img
                      src={getImageUrl(member.avatar)}
                      alt={member.name}
                      className="h-24 w-24 rounded-full border-2 border-border-strong object-cover shadow-card"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-border-strong bg-accent-gradient text-2xl font-semibold text-white">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {member.isLead && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white shadow-card">
                      {t('castSection.leadLabel')}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 truncate text-sm font-medium text-white">{member.name}</p>
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
