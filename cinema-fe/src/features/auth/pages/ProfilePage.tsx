import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { MovieCard } from '@/components/common/MovieCard';
import { CinemaCard } from '@/components/common/CinemaCard';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from '@/features/notifications/toast';
import { useMyLikedMovies } from '@/features/movies/hooks/useMyLikedMovies';
import { useFavoriteCinemas } from '@/features/movies/hooks/useFavoriteCinemas';
import { useMyInvoices } from '@/features/booking/hooks/useMyInvoices';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { updateProfile } from '../api/auth.api';
import { ROUTES } from '@/constants/routes';
import type { ProfileMovie } from '../types/auth.types';
import { MAX_AVATAR_BYTES } from '@/constants/upload';

const ProfilePage = () => {
  const { t } = useTranslation('auth');
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useCurrentUser();
  const [uploading, setUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const bookingsQuery = useMyInvoices();
  const likedMoviesQuery = useMyLikedMovies();
  const favoriteCinemasQuery = useFavoriteCinemas();

  const bookedMovies = (() => {
    const seen = new Set<number>();
    const list: ProfileMovie[] = [];
    for (const inv of bookingsQuery.data ?? []) {
      if (inv.movie && !seen.has(inv.movie.id)) {
        seen.add(inv.movie.id);
        list.push(inv.movie);
      }
    }
    return list;
  })();

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t('profile.avatarTooLarge'));
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setUploading(true);
      try {
        await updateProfile({ avatar: dataUrl });
        await queryClient.invalidateQueries({ queryKey: ['currentUser'] });
        toast.success(t('profile.avatarUpdateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <AccountLayout title={t('profile.title')}>
      {isLoading && (
        <div className="flex w-full justify-center rounded-2xl border border-border bg-surface py-8">
          <Spinner size="lg" />
        </div>
      )}
      {isError && (
        <p className="w-full rounded-2xl border border-border bg-surface p-6 text-sm text-red-400">
          {t('profile.loadAccountFailed')}
        </p>
      )}

      {user && (
        <>
          <div className="w-full rounded-2xl border border-border bg-surface p-8 text-white shadow-card">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border-strong bg-accent-gradient"
                  title={t('profile.changeAvatar')}
                >
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name || user.email}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white">
                      {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {uploading ? (
                      <Spinner size="sm" className="text-white" />
                    ) : (
                      t('profile.changeAvatarShort')
                    )}
                  </span>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <div className="text-left">
                  <p className="text-xl font-semibold">{user.name || t('profile.unnamed')}</p>
                  <p className="text-sm text-txt/70">{user.email}</p>
                </div>
              </div>

              <div className="hidden h-16 w-px shrink-0 bg-border lg:block" />

              <div className="flex flex-wrap gap-x-12 gap-y-4 text-left">
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
                    {t('profile.fullNameLabel')}
                  </span>
                  <span className="mt-0.5 block font-medium text-white">{user.name || '—'}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
                    {t('profile.emailLabel')}
                  </span>
                  <span className="mt-0.5 block font-medium text-white">{user.email}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wide text-txt/50">
                    {t('profile.phoneLabel')}
                  </span>
                  <span className="mt-0.5 block font-medium text-white">{user.phone || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{t('profile.bookedMovies')}</h2>
              <Link
                to={ROUTES.myBookings}
                className="text-sm text-accent no-underline hover:underline"
              >
                {t('profile.viewAll')}
              </Link>
            </div>
            {bookingsQuery.isLoading && <Spinner size="sm" className="mt-3" />}
            {!bookingsQuery.isLoading && bookedMovies.length === 0 && (
              <EmptyState title={t('profile.noBookedMovies')} icon="fa-solid fa-ticket" />
            )}
            <div className="mt-3 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {bookedMovies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} ctaLabel={t('profile.moreDetails')} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
            <h2 className="text-xl font-semibold">{t('profile.likedMovies')}</h2>
            {likedMoviesQuery.isLoading && <Spinner size="sm" className="mt-3" />}
            {!likedMoviesQuery.isLoading && (likedMoviesQuery.data?.length ?? 0) === 0 && (
              <EmptyState title={t('profile.noLikedMovies')} icon="fa-solid fa-heart" />
            )}
            <div className="mt-3 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {likedMoviesQuery.data?.map((movie) => (
                <MovieCard key={movie.id} movie={movie} ctaLabel={t('profile.moreDetails')} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-6 text-white shadow-card">
            <h2 className="text-xl font-semibold">{t('profile.favoriteCinemas')}</h2>
            {favoriteCinemasQuery.isLoading && <Spinner size="sm" className="mt-3" />}
            {!favoriteCinemasQuery.isLoading && (favoriteCinemasQuery.data?.length ?? 0) === 0 && (
              <EmptyState title={t('profile.noFavoriteCinemas')} icon="fa-solid fa-building" />
            )}
            <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {favoriteCinemasQuery.data?.map((cinema) => (
                <CinemaCard key={cinema.id} cinema={cinema} />
              ))}
            </div>
          </div>
        </>
      )}
    </AccountLayout>
  );
};

export default ProfilePage;
