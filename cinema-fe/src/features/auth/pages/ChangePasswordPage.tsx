import { useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { toFormikValidate } from '@/lib/formikZod';
import { useTranslation } from 'react-i18next';
import { AccountLayout } from '@/components/layout/AccountLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/apiError';
import { useChangePassword } from '../hooks/useChangePassword';
import {
  buildChangePasswordSchema,
  type ChangePasswordFormValues,
} from '../schemas/changePassword.schema';
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
    <AccountLayout title={t('changePassword.title')}>
      <Formik<ChangePasswordFormValues>
        initialValues={{ currentPassword: '', newPassword: '', c_password: '' }}
        validate={toFormikValidate<ChangePasswordFormValues>(changePasswordSchema)}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <Form className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-card">
            <div>
              <Field
                as={Input}
                label={t('changePassword.currentPasswordLabel')}
                type="password"
                id="currentPassword"
                name="currentPassword"
                error={formik.touched.currentPassword ? formik.errors.currentPassword : undefined}
              />
            </div>
            <div className="mt-4">
              <Field
                as={Input}
                label={t('changePassword.newPasswordLabel')}
                type="password"
                id="newPassword"
                name="newPassword"
                error={formik.touched.newPassword ? formik.errors.newPassword : undefined}
              />
            </div>
            <div className="mt-4">
              <Field
                as={Input}
                label={t('changePassword.confirmPasswordLabel')}
                type="password"
                id="c_password"
                name="c_password"
                error={formik.touched.c_password ? formik.errors.c_password : undefined}
              />
            </div>

            {serverError && <p className="mt-4 text-sm text-red-400">{serverError}</p>}

            <Button
              type="submit"
              loading={changePasswordMutation.isPending}
              className="mt-6 w-full"
            >
              {t('changePassword.submit')}
            </Button>
          </Form>
        )}
      </Formik>
    </AccountLayout>
  );
};

export default ChangePasswordPage;
