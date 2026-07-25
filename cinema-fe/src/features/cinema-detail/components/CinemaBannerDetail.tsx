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
      <div className="flex justify-center bg-gradient-to-b from-[#0B1A2A] to-main py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-b from-[#0B1A2A] to-main">
      <div className="w-full px-6 py-16 md:px-16">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 md:flex-row">
          {cinema.images?.[0] ? (
            <img
              src={getImageUrl(cinema.images[0])}
              alt={cinema.name}
              className="h-[420px] w-[280px] shrink-0 self-center rounded-lg border-2 border-accent object-cover shadow-2xl shadow-black md:self-start"
            />
          ) : (
            <div className="flex h-[420px] w-[280px] shrink-0 items-center justify-center self-center rounded-lg border-2 border-accent bg-white/5 shadow-2xl shadow-black md:self-start">
              <i className="fa-solid fa-film text-6xl text-white/20" />
            </div>
          )}
          <div className="flex-1 text-white">
            <h1 className="text-3xl font-bold md:text-4xl">{cinema.name}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1">
                <i className="fa-solid fa-location-dot text-accent" />
                {[cinema.address, cinema.city].filter(Boolean).join(', ') || t('bannerDetail.addressUpdating')}
              </span>
              <span className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1">
                <i className="fa-solid fa-heart text-accent" /> {t('bannerDetail.favoriteCount', { count: favoriteCount })}
              </span>
              <span className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1">
                <i className="fa-solid fa-circle-check text-accent" /> {statusLabel}
              </span>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <a
                href="#showtimes"
                className="rounded-md bg-accent px-6 py-2.5 font-medium text-white no-underline transition-colors hover:bg-white hover:text-accent"
              >
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
