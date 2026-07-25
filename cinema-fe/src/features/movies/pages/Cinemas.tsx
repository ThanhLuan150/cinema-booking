import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { getImageUrl } from '@/utils';
import { getCinemasList } from '../api/movies.api';
import { ROUTES } from '@/constants/routes';

const Cinemas = () => {
  const { t } = useTranslation('movies');
  const { data: cinemas = [], isLoading } = useQuery({
    queryKey: ['cinemas'],
    queryFn: getCinemasList,
  });

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 pt-24">
        <div className="border-b border-white/10">
          <div className="mx-auto flex w-4/5 items-center gap-2 py-3 text-sm text-txt/70">
            <a href={ROUTES.home} className="text-txt/70 no-underline hover:text-accent">
              <i className="fa-solid fa-house" />
            </a>
            <i className="fa-solid fa-chevron-right text-xs text-accent" />
            <span className="font-semibold text-white">{t('cinemas.breadcrumb')}</span>
          </div>
        </div>

        <div className="mx-auto w-4/5 py-8">
          <h5 className="mb-6 text-2xl text-white">{t('cinemas.title')}</h5>
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : cinemas.length === 0 ? (
            <EmptyState title={t('cinemas.empty')} />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {cinemas.map((cinema) => (
                <a
                  key={cinema.id}
                  href={ROUTES.cinemaDetail(cinema.id)}
                  className="group relative block overflow-hidden rounded-xl no-underline shadow-lg shadow-black/40"
                >
                  {cinema.images?.[0] ? (
                    <img
                      src={getImageUrl(cinema.images[0])}
                      alt={cinema.name}
                      className="h-[220px] w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-[220px] w-full items-center justify-center bg-gradient-to-br from-[#1A293C] to-main">
                      <i className="fa-solid fa-film text-5xl text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
                  <div className="absolute inset-0 flex flex-col justify-end p-4 text-left">
                    <h6 className="truncate text-base font-semibold text-white">{cinema.name}</h6>
                    <p className="mt-1 truncate text-xs text-txt/70">
                      <i className="fa-solid fa-location-dot mr-1 text-accent" />
                      {[cinema.address, cinema.city].filter(Boolean).join(', ') || t('cinemas.addressUpdating')}
                    </p>
                    <span className="mt-2 text-xs font-medium text-white/80">{t('cinemas.viewDetails')} →</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Cinemas;
