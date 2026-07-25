import { useMemo } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { buildForgotPasswordSchema, type ForgotPasswordFormValues } from '../schemas/forgotPassword.schema';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';

const ForgotPasswordPage = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const forgotPasswordMutation = useForgotPassword();

  const forgotPasswordSchema = useMemo(() => buildForgotPasswordSchema(t), [t]);

  const handleSubmit = async (
    values: ForgotPasswordFormValues,
    { setFieldError }: FormikHelpers<ForgotPasswordFormValues>,
  ) => {
    try {
      await forgotPasswordMutation.mutateAsync(values.email);
      toast.success(t('forgotPassword.resetCodeSent'));
      navigate(`${ROUTES.resetPassword}?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      setFieldError('email', getApiErrorMessage(err, t));
    }
  };

  return (
    <div className="min-h-screen w-full bg-main px-4 pb-16 pt-24">
      <Formik<ForgotPasswordFormValues>
        initialValues={{ email: '' }}
        validate={toFormikValidate<ForgotPasswordFormValues>(forgotPasswordSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form className="mx-auto w-full max-w-lg rounded-2xl bg-white p-8 text-center text-main">
            <h1 className="text-3xl font-bold">{t('forgotPassword.title')}</h1>
            <p className="mt-2 text-sm text-gray-500">{t('forgotPassword.subtitle')}</p>

            <div className="mt-6 text-left">
              <Field
                as={Input}
                label={t('forgotPassword.emailLabel')}
                type="email"
                id="email"
                name="email"
                placeholder={t('forgotPassword.emailPlaceholder')}
                error={formik.touched.email ? formik.errors.email : undefined}
              />
            </div>

            <Button type="submit" loading={forgotPasswordMutation.isPending} className="mt-6 w-full">
              {t('forgotPassword.submit')}
            </Button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default ForgotPasswordPage;
