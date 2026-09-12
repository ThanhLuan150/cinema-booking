import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { ProfileHeader } from '../components/ProfileHeader';
import { BookedMoviesSection } from '../components/BookedMoviesSection';
import { LikedMoviesSection } from '../components/LikedMoviesSection';
import { FavoriteCinemasSection } from '../components/FavoriteCinemasSection';

const ProfilePage = () => {
  const { t } = useTranslation('auth');
  const { data: user, isLoading, isError } = useCurrentUser();

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
          <ProfileHeader user={user} />
          <BookedMoviesSection />
          <LikedMoviesSection />
          <FavoriteCinemasSection />
        </>
      )}
    </AccountLayout>
  );
};

export default ProfilePage;
