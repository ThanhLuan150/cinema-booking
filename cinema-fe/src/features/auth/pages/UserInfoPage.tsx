import { useEffect, useMemo, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/common/AuthCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAccountByEmail } from '../hooks/useAccountByEmail';
import { useSaveUserInfo } from '../hooks/useSaveUserInfo';
import { buildUserInfoSchema, type UserInfoFormValues } from '../schemas/userInfo.schema';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';

const UserInfo = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const location = useLocation();
  const email = useMemo(() => new URLSearchParams(location.search).get('email'), [location.search]);
  const [errorMessage, setErrorMessage] = useState('');

  const userInfoSchema = useMemo(() => buildUserInfoSchema(t), [t]);

  const accountQuery = useAccountByEmail(email);
  const saveUserInfoMutation = useSaveUserInfo();

  useEffect(() => {
    if (accountQuery.isError) {
      setErrorMessage(t('userInfo.accountNotFound'));
    }
  }, [accountQuery.isError, t]);

  const handleSubmit = async (values: UserInfoFormValues) => {
    setErrorMessage('');
    if (!email) {
      setErrorMessage(t('userInfo.accountNotFound'));
      return;
    }
    try {
      await saveUserInfoMutation.mutateAsync({
        name: values.name,
        phone: values.phone,
        email,
      });

      toast.success(t('userInfo.saveSuccess'));

      navigate(ROUTES.login);
    } catch (error) {
      console.log(error instanceof Error ? error.message : error);
      setErrorMessage(getApiErrorMessage(error, t));
    }
  };

  return (
    <AuthCard title={t('userInfo.title')}>
      <Formik<UserInfoFormValues>
        initialValues={{ name: '', phone: '' }}
        validate={toFormikValidate<UserInfoFormValues>(userInfoSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form>
            <Field
              as={Input}
              label={t('userInfo.fullNameLabel')}
              type="text"
              id="username"
              name="name"
              placeholder={t('userInfo.fullNamePlaceholder')}
              error={formik.touched.name ? formik.errors.name : undefined}
            />
            <div className="mt-4">
              <Field
                as={Input}
                label={t('userInfo.phoneLabel')}
                type="tel"
                id="phone"
                name="phone"
                placeholder={t('userInfo.phonePlaceholder')}
                error={formik.touched.phone ? formik.errors.phone : undefined}
              />
            </div>

            <Button type="submit" loading={saveUserInfoMutation.isPending} className="mt-6 w-full">
              {t('userInfo.submit')}
            </Button>
          </Form>
        )}
      </Formik>
    </AuthCard>
  );
};

export default UserInfo;
