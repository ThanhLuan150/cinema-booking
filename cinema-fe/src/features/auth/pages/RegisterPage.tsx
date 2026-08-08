import { useMemo } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/common/AuthCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCheckEmail } from '../hooks/useCheckEmail';
import { useRegister } from '../hooks/useRegister';
import { buildRegisterSchema, type RegisterFormValues } from '../schemas/register.schema';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';

const Register = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const checkEmailMutation = useCheckEmail();
  const registerMutation = useRegister();

  const registerSchema = useMemo(() => buildRegisterSchema(t), [t]);
  const emailParam = useMemo(() => new URLSearchParams(window.location.search).get('email') ?? '', []);

  const handleSubmit = async (values: RegisterFormValues, { setFieldError }: FormikHelpers<RegisterFormValues>) => {
    try {
      const checkEmailResponse = await checkEmailMutation.mutateAsync(values.email);

      if (checkEmailResponse.data.exists) {
        setFieldError('email', t('errors:EMAIL_ALREADY_EXISTS'));
        return;
      }

      await registerMutation.mutateAsync(values);

      toast.success(t('register.registerSuccess'));

      navigate(`${ROUTES.verifyCode}?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AuthCard title={t('register.title')}>
      <Formik<RegisterFormValues>
        initialValues={{ email: emailParam, password: '', c_password: '' }}
        validate={toFormikValidate<RegisterFormValues>(registerSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form>
            <Field
              as={Input}
              label={t('register.emailLabel')}
              type="email"
              id="email"
              name="email"
              placeholder={t('register.emailPlaceholder')}
              error={formik.touched.email ? formik.errors.email : undefined}
            />
            <div className="mt-4">
              <Field
                as={Input}
                label={t('register.passwordLabel')}
                type="password"
                id="pwd"
                name="password"
                placeholder={t('register.passwordPlaceholder')}
                error={formik.touched.password ? formik.errors.password : undefined}
              />
            </div>
            <div className="mt-4">
              <Field
                as={Input}
                label={t('register.confirmPasswordLabel')}
                type="password"
                id="confirm-pwd"
                name="c_password"
                placeholder={t('register.confirmPasswordPlaceholder')}
                error={formik.touched.c_password ? formik.errors.c_password : undefined}
              />
            </div>
            <Button type="submit" loading={registerMutation.isPending} className="mt-6 w-full">
              {t('register.submit')}
            </Button>

            <p className="mt-4 text-center text-sm text-txt/60">
              {t('register.alreadyHaveAccount')}{' '}
              <Link to={ROUTES.login} className="text-accent no-underline hover:underline">
                {t('register.loginLink')}
              </Link>
            </p>
          </Form>
        )}
      </Formik>
    </AuthCard>
  );
};

export default Register;
