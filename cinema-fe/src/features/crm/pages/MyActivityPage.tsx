import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useMyCrmProfile } from '../hooks/useMyCrmProfile';
import { CustomerProfileCard } from '../components/CustomerProfileCard';

function MyActivityPage() {
  const { t } = useTranslation('crm');
  const { data: profile, isLoading, isError } = useMyCrmProfile();

  return (
    <AccountLayout title={t('pageTitle')}>
      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState title={t('error.generic')} icon="fa-solid fa-triangle-exclamation" />
      )}

      {profile && !isLoading && (
        <>
          <p className="text-sm text-txt/60">{t('selfIntro')}</p>
          <CustomerProfileCard profile={profile} variant="self" />
        </>
      )}
    </AccountLayout>
  );
}

export default MyActivityPage;
