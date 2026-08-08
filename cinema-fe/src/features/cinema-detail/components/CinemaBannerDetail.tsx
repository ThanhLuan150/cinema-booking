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
  const statusLabel = statusMetaKey
    ? t(STATUS_LABEL_KEY[statusMetaKey])
    : t('bannerDetail.notAvailable');

  if (!cinema) {
    return (
      <div className="flex justify-center bg-gradient-to-b from-surface-raised to-main py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <section className="w-full">
      <div className="relative max-h-[420px] w-full overflow-hidden">
        {cinema.images?.[0] ? (
          <img
            src={getImageUrl(cinema.images[0])}
            alt={cinema.name}
            className="aspect-[21/9] w-full object-cover"
          />
        ) : (
          <div className="flex aspect-[21/9] w-full items-center justify-center bg-gradient-to-br from-surface-raised to-main">
            <i className="fa-solid fa-film text-6xl text-white/10" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-main via-main/50 to-transparent" />
      </div>

      <div className="relative z-[1] mx-auto -mt-24 w-full max-w-7xl px-6 md:px-10">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-raised md:p-8">
          <h1 className="text-2xl font-bold uppercase text-white md:text-3xl">{cinema.name}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
            <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-white/5 px-3 py-1">
              <i className="fa-solid fa-location-dot text-accent" />
              {[cinema.address, cinema.city].filter(Boolean).join(', ') ||
                t('bannerDetail.addressUpdating')}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-border-strong bg-white/5 px-3 py-1">
              <i className="fa-solid fa-heart text-accent" />
              {t('bannerDetail.favoriteCount', { count: favoriteCount })}
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 font-medium text-gold">
              <i className="fa-solid fa-circle-check" /> {statusLabel}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a
              href="#showtimes"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-7 py-3 text-sm font-bold uppercase tracking-wide text-white no-underline shadow-card transition-all hover:bg-accent-hover hover:shadow-glow"
            >
              <i className="fa-solid fa-clapperboard" />
              {t('bannerDetail.viewShowtimes')}
            </a>
            <FavoriteCinemaButton branchId={cinema.id} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CinemaBannerDetail;
