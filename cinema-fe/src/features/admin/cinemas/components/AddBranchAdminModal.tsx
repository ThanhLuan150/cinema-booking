import { useCallback } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useCreateBranchAdmin } from '../hooks/useCinemaModeration';
import type { CreateBranchAdminPayload } from '../types/cinemas.types';
import { emptyBranchAdminForm } from '../constants';

export interface AddBranchAdminModalProps {
  onClose: () => void;
}

export function AddBranchAdminModal({ onClose }: AddBranchAdminModalProps) {
  const { t } = useTranslation('admin');
  const createBranchAdminMutation = useCreateBranchAdmin();

  const handleCreateBranchAdmin = useCallback(
    async (values: CreateBranchAdminPayload, { resetForm }: FormikHelpers<CreateBranchAdminPayload>) => {
      try {
        await createBranchAdminMutation.mutateAsync(values);
        toast.success(t('cinemas.addBranchAdmin.success'));
        resetForm();
        onClose();
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createBranchAdminMutation, onClose, t],
  );

  const validateBranchAdmin = useCallback(
    (values: CreateBranchAdminPayload) => {
      const errors: Partial<Record<keyof CreateBranchAdminPayload, string>> = {};
      if (!values.email) errors.email = t('cinemas.addBranchAdmin.validation.emailRequired');
      if (!values.password || values.password.length < 6) {
        errors.password = t('cinemas.addBranchAdmin.validation.passwordInvalid');
      }
      if (!values.cinema_name) errors.cinema_name = t('cinemas.addBranchAdmin.validation.cinemaNameRequired');
      if (!values.code) errors.code = t('cinemas.addBranchAdmin.validation.codeRequired');
      return errors;
    },
    [t],
  );

  return (
    <Modal open onClose={onClose} title={t('cinemas.addBranchAdmin.title')}>
      <Formik<CreateBranchAdminPayload>
        initialValues={emptyBranchAdminForm()}
        validate={validateBranchAdmin}
        onSubmit={handleCreateBranchAdmin}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Input}
                label={t('cinemas.addBranchAdmin.emailLabel')}
                name="email"
                type="email"
                error={showErrors ? formik.errors.email : undefined}
              />
              <Field
                as={Input}
                label={t('cinemas.addBranchAdmin.passwordLabel')}
                name="password"
                type="password"
                className="mt-3"
                error={showErrors ? formik.errors.password : undefined}
              />
              <Field as={Input} label={t('cinemas.addBranchAdmin.nameLabel')} name="name" className="mt-3" />
              <Field as={Input} label={t('cinemas.addBranchAdmin.phoneLabel')} name="phone" className="mt-3" />
              <Field
                as={Input}
                label={t('cinemas.addBranchAdmin.cinemaNameLabel')}
                name="cinema_name"
                className="mt-3"
                error={showErrors ? formik.errors.cinema_name : undefined}
              />
              <Field
                as={Input}
                label={t('cinemas.addBranchAdmin.codeLabel')}
                name="code"
                className="mt-3"
                error={showErrors ? formik.errors.code : undefined}
              />
              <Field as={Input} label={t('cinemas.addBranchAdmin.addressLabel')} name="address" className="mt-3" />
              <Field as={Input} label={t('cinemas.addBranchAdmin.cityLabel')} name="city" className="mt-3" />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={createBranchAdminMutation.isPending}>
                  {t('cinemas.addBranchAdmin.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
