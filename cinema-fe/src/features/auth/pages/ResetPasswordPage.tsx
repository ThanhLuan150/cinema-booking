import { useMemo, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useResetPassword } from '../hooks/useResetPassword';
import { buildResetPasswordSchema, type ResetPasswordFormValues } from '../schemas/resetPassword.schema';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';

const ResetPasswordPage = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const email = useMemo(() => new URLSearchParams(window.location.search).get('email') ?? '', []);
  const [serverError, setServerError] = useState('');
  const resetPasswordMutation = useResetPassword();

  const resetPasswordSchema = useMemo(() => buildResetPasswordSchema(t), [t]);

  const handleSubmit = async (values: ResetPasswordFormValues) => {
    setServerError('');
    try {
      await resetPasswordMutation.mutateAsync({ email, ...values });
      toast.success(t('resetPassword.resetSuccess'));
      navigate(ROUTES.login);
    } catch (err) {
      setServerError(getApiErrorMessage(err, t));
    }
  };

  return (
    <div className="min-h-screen w-full bg-main px-4 pb-16 pt-24">
      <Formik<ResetPasswordFormValues>
        initialValues={{ otp: '', password: '', c_password: '' }}
        validate={toFormikValidate<ResetPasswordFormValues>(resetPasswordSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form className="mx-auto w-full max-w-lg rounded-2xl bg-white p-8 text-center text-main">
            <h1 className="text-3xl font-bold">{t('resetPassword.title')}</h1>
            <p className="mt-2 text-sm text-gray-500">
              {t('resetPassword.subtitle', { email: email || t('resetPassword.yourEmail') })}
            </p>

            <div className="mt-6 text-left">
              <Field
                as={Input}
                label={t('resetPassword.otpLabel')}
                type="text"
                id="otp"
                name="otp"
                error={formik.touched.otp ? formik.errors.otp : undefined}
              />
            </div>
            <div className="mt-4 text-left">
              <Field
                as={Input}
                label={t('resetPassword.passwordLabel')}
                type="password"
                id="password"
                name="password"
                error={formik.touched.password ? formik.errors.password : undefined}
              />
            </div>
            <div className="mt-4 text-left">
              <Field
                as={Input}
                label={t('resetPassword.confirmPasswordLabel')}
                type="password"
                id="c_password"
                name="c_password"
                error={formik.touched.c_password ? formik.errors.c_password : undefined}
              />
            </div>

            {serverError && <p className="mt-4 text-sm text-red-600">{serverError}</p>}

            <Button type="submit" loading={resetPasswordMutation.isPending} className="mt-6 w-full">
              {t('resetPassword.submit')}
            </Button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ResetPasswordPage;
