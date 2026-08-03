import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FavoriteCinemaButton } from '@/features/movies/components/FavoriteCinemaButton';
import { Spinner } from '@/components/ui/Spinner';
import { getImageUrl } from '@/utils';
import { useCinemaDetail } from '../hooks/useCinemaDetail';
import { useCinemaFavoriteCount } from '../hooks/useCinemaFavoriteCount';
import { CINEMA_STATUS_META } from '@/constants/cinemaStatus';

const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'bannerDetail.statusPending',
  approved: 'bannerDetail.statusActive',
  blocked: 'bannerDetail.statusPaused',
};

const CinemaBannerDetail = () => {
  const { t } = useTranslation('cinemaDetail');
  const { id } = useParams<{ id: string }>();
  const { data: cinema } = useCinemaDetail(id);
  const { data: favoriteCount = 0 } = useCinemaFavoriteCount(id);

  const statusMetaKey = cinema && CINEMA_STATUS_META[cinema.status]?.key;
  const statusLabel = statusMetaKey ? t(STATUS_LABEL_KEY[statusMetaKey]) : t('bannerDetail.notAvailable');

  if (!cinema) {
    return (
      <div className="flex justify-center bg-gradient-to-b from-surface-raised to-main py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden bg-gradient-to-b from-surface-raised to-main">
      {cinema.images?.[0] && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-2xl"
          style={{ backgroundImage: `url(${getImageUrl(cinema.images[0])})` }}
          aria-hidden="true"
        />
      )}
      <div className="relative w-full px-6 py-16 md:px-10 md:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row">
          {cinema.images?.[0] ? (
            <img
              src={getImageUrl(cinema.images[0])}
              alt={cinema.name}
              className="h-[420px] w-[280px] shrink-0 self-center rounded-xl border-2 border-accent/60 object-cover shadow-raised md:self-start"
            />
          ) : (
            <div className="flex h-[420px] w-[280px] shrink-0 items-center justify-center self-center rounded-xl border-2 border-accent/60 bg-surface shadow-raised md:self-start">
              <i className="fa-solid fa-film text-6xl text-white/15" />
            </div>
          )}
          <div className="flex-1 text-white">
            <h1 className="text-2xl font-bold md:text-3xl">{cinema.name}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-white/5 px-3 py-1">
                <i className="fa-solid fa-location-dot text-accent" />
                {[cinema.address, cinema.city].filter(Boolean).join(', ') || t('bannerDetail.addressUpdating')}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-white/5 px-3 py-1">
                <i className="fa-solid fa-heart text-accent" /> {t('bannerDetail.favoriteCount', { count: favoriteCount })}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-medium text-gold">
                <i className="fa-solid fa-circle-check" /> {statusLabel}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#showtimes"
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
              >
                <i className="fa-solid fa-clapperboard" />
                {t('bannerDetail.viewShowtimes')}
              </a>
              <FavoriteCinemaButton cinemaId={cinema.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CinemaBannerDetail;
