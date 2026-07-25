import { useMemo, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from 'services/apiClient';
import { useAppDispatch } from '@/hooks/redux';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { login as loginAction } from '../store/authSlice';
import { useLogin } from '../hooks/useLogin';
import { buildLoginSchema, type LoginFormValues } from '../schemas/login.schema';
import { toast } from '@/features/notifications/toast';
import { ROUTES } from '@/constants/routes';
import { ROLES } from '@/constants/roles';

const LoginForm = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const loginMutation = useLogin();

  const loginSchema = useMemo(() => buildLoginSchema(t), [t]);

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      const response = await loginMutation.mutateAsync(values);
      const { token, account, user_id, role } = response.data;

      if (!token) {
        throw new Error(t('login.accountNotFound'));
      }

      queryClient.clear();
      dispatch(loginAction({ token, userId: user_id, role, account }));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      toast.success(t('login.loginSuccess'));
      if (role == String(ROLES.customer)) {
        navigate(ROUTES.home);
      } else {
        navigate(ROUTES.adminMovies);
      }
    } catch (err) {
      const message = getApiErrorMessage(err, t);
      toast.error(message);
      setError(message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-main px-4 pb-16 pt-24">
      <Formik<LoginFormValues>
        initialValues={{ email: '', password: '' }}
        validate={toFormikValidate<LoginFormValues>(loginSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form className="mx-auto w-full max-w-lg rounded-2xl bg-white p-8 text-center text-main">
            <h1 className="text-3xl font-bold">{t('login.title')}</h1>

            <div className="mt-6 text-left">
              <Field
                as={Input}
                label={t('login.emailLabel')}
                type="text"
                id="email"
                name="email"
                placeholder={t('login.emailPlaceholder')}
                error={formik.touched.email ? formik.errors.email : undefined}
              />
            </div>
            <div className="mt-4 text-left">
              <Field
                as={Input}
                label={t('login.passwordLabel')}
                type="password"
                id="pwd"
                name="password"
                placeholder={t('login.passwordPlaceholder')}
                error={formik.touched.password ? formik.errors.password : undefined}
              />
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <a href={ROUTES.register} className="text-accent hover:underline">
                {t('login.registerLink')}
              </a>
              <a href={ROUTES.forgotPassword} className="text-accent hover:underline">
                {t('login.forgotPasswordLink')}
              </a>
              <a href={ROUTES.home} className="text-accent hover:underline">
                {t('login.homeLink')}
              </a>
            </div>

            <Button type="submit" loading={loginMutation.isPending} className="mt-6 w-full">
              {t('login.submit')}
            </Button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default LoginForm;
