import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { RequestEventForm } from '../components/RequestEventForm';

function RequestEventPage() {
  const { t } = useTranslation('privateEvents');

  return (
    <AccountLayout title={t('request.pageTitle')}>
      <RequestEventForm />
    </AccountLayout>
  );
}

export default RequestEventPage;
