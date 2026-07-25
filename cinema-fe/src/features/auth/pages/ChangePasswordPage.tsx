import { useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useChangePassword } from '../hooks/useChangePassword';
import { buildChangePasswordSchema, type ChangePasswordFormValues } from '../schemas/changePassword.schema';
import { toast } from '@/features/notifications/toast';

const ChangePasswordPage = () => {
  const { t } = useTranslation('auth');
  const [serverError, setServerError] = useState('');
  const changePasswordMutation = useChangePassword();

  const changePasswordSchema = useMemo(() => buildChangePasswordSchema(t), [t]);

  const handleSubmit = async (
    values: ChangePasswordFormValues,
    { resetForm }: FormikHelpers<ChangePasswordFormValues>,
  ) => {
    setServerError('');
    try {
      await changePasswordMutation.mutateAsync(values);
      toast.success(t('changePassword.changeSuccess'));
      resetForm();
    } catch (err) {
      setServerError(getApiErrorMessage(err, t));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-main">
      <Header />
      <div className="flex-1 w-full px-4 pb-16 pt-24">
        <Formik<ChangePasswordFormValues>
          initialValues={{ currentPassword: '', newPassword: '', c_password: '' }}
          validate={toFormikValidate<ChangePasswordFormValues>(changePasswordSchema)}
          onSubmit={handleSubmit}
        >
          {(formik) => (
            <Form className="mx-auto w-full max-w-lg rounded-2xl bg-white p-8 text-center text-main">
              <h1 className="text-3xl font-bold">{t('changePassword.title')}</h1>

              <div className="mt-6 text-left">
                <Field
                  as={Input}
                  label={t('changePassword.currentPasswordLabel')}
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  error={formik.touched.currentPassword ? formik.errors.currentPassword : undefined}
                />
              </div>
              <div className="mt-4 text-left">
                <Field
                  as={Input}
                  label={t('changePassword.newPasswordLabel')}
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  error={formik.touched.newPassword ? formik.errors.newPassword : undefined}
                />
              </div>
              <div className="mt-4 text-left">
                <Field
                  as={Input}
                  label={t('changePassword.confirmPasswordLabel')}
                  type="password"
                  id="c_password"
                  name="c_password"
                  error={formik.touched.c_password ? formik.errors.c_password : undefined}
                />
              </div>

              {serverError && <p className="mt-4 text-sm text-red-600">{serverError}</p>}

              <Button type="submit" loading={changePasswordMutation.isPending} className="mt-6 w-full">
                {t('changePassword.submit')}
              </Button>
            </Form>
          )}
        </Formik>
      </div>
      <Footer />
    </div>
  );
};

export default ChangePasswordPage;
