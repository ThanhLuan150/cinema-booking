import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { ChangePasswordForm } from '../components/ChangePasswordForm';

const ChangePasswordPage = () => {
  const { t } = useTranslation('auth');

  return (
    <AccountLayout title={t('changePassword.title')}>
      <ChangePasswordForm />
    </AccountLayout>
  );
};

export default ChangePasswordPage;
