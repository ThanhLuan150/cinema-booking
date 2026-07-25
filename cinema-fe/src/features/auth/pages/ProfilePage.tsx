import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { getMoviePosterUrl } from '@/utils';
import { getApiErrorMessage } from '@/lib/apiError';
import { toast } from '@/features/notifications/toast';
import Like from '@/features/movies/components/Like';
import { useMyLikedMovies } from '@/features/movies/hooks/useMyLikedMovies';
import { useFavoriteCinemas } from '@/features/movies/hooks/useFavoriteCinemas';
import { useMyInvoices } from '@/features/booking/hooks/useMyInvoices';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { updateProfile } from '../api/auth.api';
import { ROUTES } from '@/constants/routes';
import type { ProfileMovie } from '../types/auth.types';
import { MAX_VISIBLE_CATEGORIES } from '@/constants/movieCard';
import { MAX_AVATAR_BYTES } from '@/constants/upload';

function MovieCard({ movie }: { movie: ProfileMovie }) {
  const { t } = useTranslation('auth');
  return (
    <div className="group overflow-hidden rounded-lg bg-white/5">
      <div className="overflow-hidden">
        <img
          src={getMoviePosterUrl(movie.avatar)}
          alt={movie.name}
          className="h-[250px] w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h6 className="truncate text-base text-white">{movie.name}</h6>
        <div className="mt-2 flex flex-wrap gap-1">
          {(movie.categories || []).slice(0, MAX_VISIBLE_CATEGORIES).map((cat) => (
            <span key={cat.id} className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">
              {cat.name}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between">
          <Like movieId={movie.id} />
          <Link
            to={ROUTES.movieDetail(movie.id)}
            className="rounded bg-accent px-3 py-1.5 text-xs text-white no-underline transition-colors hover:bg-white hover:text-accent"
          >
            {t('profile.moreDetails')}
          </Link>
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 w-full pb-16 pt-24">
        <div className="mx-auto flex w-4/5 flex-col gap-6">
          <h1 className="text-3xl font-bold text-white">{t('profile.title')}</h1>

          {isLoading && (
            <div className="mx-auto flex w-full max-w-3xl justify-center rounded-2xl bg-white/5 py-8">
              <Spinner size="lg" />
            </div>
          )}
          {isError && (
            <p className="mx-auto w-full max-w-3xl rounded-2xl bg-white/5 p-6 text-sm text-red-400">
              {t('profile.loadAccountFailed')}
            </p>
          )}

          {user && (
            <>
              <div className="mx-auto w-full max-w-3xl rounded-2xl bg-white/5 p-8 text-white">
                <div className="flex items-center gap-5">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white/20 bg-white/10"
                    title={t('profile.changeAvatar')}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt={user.name || user.email} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white/60">
                        {(user.name || user.email || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {uploading ? <Spinner size="sm" className="text-white" /> : t('profile.changeAvatarShort')}
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

                <div className="mt-6 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
                  <div>
                    <span className="block text-sm font-medium text-txt/60">{t('profile.fullNameLabel')}</span>
                    <span className="block text-lg">{user.name || '—'}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-txt/60">{t('profile.emailLabel')}</span>
                    <span className="block text-lg">{user.email}</span>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-txt/60">{t('profile.phoneLabel')}</span>
                    <span className="block text-lg">{user.phone || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-6 text-white">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">{t('profile.bookedMovies')}</h2>
                  <Link to={ROUTES.myBookings} className="text-sm text-accent hover:underline">
                    {t('profile.viewAll')}
                  </Link>
                </div>
                {bookingsQuery.isLoading && <Spinner size="sm" className="mt-3" />}
                {!bookingsQuery.isLoading && bookedMovies.length === 0 && (
                  <EmptyState title={t('profile.noBookedMovies')} />
                )}
                <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {bookedMovies.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-6 text-white">
                <h2 className="text-xl font-semibold">{t('profile.likedMovies')}</h2>
                {likedMoviesQuery.isLoading && <Spinner size="sm" className="mt-3" />}
                {!likedMoviesQuery.isLoading && (likedMoviesQuery.data?.length ?? 0) === 0 && (
                  <EmptyState title={t('profile.noLikedMovies')} />
                )}
                <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  {likedMoviesQuery.data?.map((movie) => (
                    <MovieCard key={movie.id} movie={movie} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white/5 p-6 text-white">
                <h2 className="text-xl font-semibold">{t('profile.favoriteCinemas')}</h2>
                {favoriteCinemasQuery.isLoading && <Spinner size="sm" className="mt-3" />}
                {!favoriteCinemasQuery.isLoading && (favoriteCinemasQuery.data?.length ?? 0) === 0 && (
                  <EmptyState title={t('profile.noFavoriteCinemas')} />
                )}
                <div className="mt-3 flex flex-col gap-2">
                  {favoriteCinemasQuery.data?.map((cinema) => (
                    <div key={cinema.id} className="rounded-md border border-white/10 px-4 py-2">
                      <p className="font-medium">{cinema.name}</p>
                      <p className="text-sm text-txt/70">
                        {cinema.address} {cinema.city}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProfilePage;
