import { useMemo, useState } from 'react';
import { Formik, Field, Form } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiClient from 'services/apiClient';
import { useAppDispatch } from '@/hooks/redux';
import { AuthCard } from '@/components/common/AuthCard';
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
      const { accessToken, account, user_id, role } = response.data;

      if (!accessToken) {
        throw new Error(t('login.accountNotFound'));
      }

      queryClient.clear();
      dispatch(loginAction({ accessToken, userId: user_id, role, account }));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      toast.success(t('login.loginSuccess'));
      if (role == String(ROLES.customer)) {
        navigate(ROUTES.home);
      } else if (role == String(ROLES.admin)) {
        navigate(ROUTES.adminDashboard);
      } else if (role == String(ROLES.employee)) {
        navigate(ROUTES.employeeDashboard);
      } else {
        navigate(ROUTES.ownerDashboard);
      }
    } catch (err) {
      const message = getApiErrorMessage(err, t);
      toast.error(message);
      setError(message);
    }
  };

  return (
    <AuthCard title={t('login.title')}>
      <Formik<LoginFormValues>
        initialValues={{ email: '', password: '' }}
        validate={toFormikValidate<LoginFormValues>(loginSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form>
            <Field
              as={Input}
              label={t('login.emailLabel')}
              type="text"
              id="email"
              name="email"
              placeholder={t('login.emailPlaceholder')}
              error={formik.touched.email ? formik.errors.email : undefined}
            />
            <div className="mt-4">
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
              <Link to={ROUTES.register} className="text-accent no-underline hover:underline">
                {t('login.registerLink')}
              </Link>
              <Link to={ROUTES.forgotPassword} className="text-accent no-underline hover:underline">
                {t('login.forgotPasswordLink')}
              </Link>
            </div>

            <Button type="submit" loading={loginMutation.isPending} className="mt-6 w-full">
              {t('login.submit')}
            </Button>

            <Link
              to={ROUTES.home}
              className="mt-4 flex items-center justify-center gap-1.5 text-sm text-txt/50 no-underline hover:text-txt"
            >
              <i className="fa-solid fa-arrow-left text-xs" />
              {t('login.homeLink')}
            </Link>
          </Form>
        )}
      </Formik>
    </AuthCard>
  );
};

export default LoginForm;
