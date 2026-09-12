import { useCallback, useRef, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch } from '@/hooks/redux';
import { useCreateActor } from '../hooks/useActorMutations';
import { closeAddModal } from '../store/adminActorsSlice';
import type { ActorFormValues } from '../types/actor.types';
import { emptyForm } from '../constants';

const Add = () => {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const createActorMutation = useCreateActor();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleSubmit = useCallback(
    async (values: ActorFormValues, { resetForm }: FormikHelpers<ActorFormValues>) => {
      try {
        await createActorMutation.mutateAsync({ ...values, avatarFile });
        if (avatarInputRef.current) avatarInputRef.current.value = '';
        setAvatarFile(null);
        toast.success(t('actors.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [avatarFile, createActorMutation, dispatch, t],
  );

  const validateActor = useCallback(
    (values: ActorFormValues) => {
      const errors: Partial<Record<keyof ActorFormValues, string>> = {};
      if (!values.full_name.trim()) errors.full_name = t('actors.validation.fullNameRequired');
      return errors;
    },
    [t],
  );

  return (
    <Modal open onClose={() => dispatch(closeAddModal())} title={t('actors.addTitle')}>
      <Formik<ActorFormValues> initialValues={emptyForm()} validate={validateActor} onSubmit={handleSubmit}>
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form encType="multipart/form-data">
              <Field
                as={Input}
                label={t('actors.fullNameLabel')}
                name="full_name"
                error={showErrors ? formik.errors.full_name : undefined}
              />
              <Input
                label={t('actors.avatarUrlLabel')}
                type="file"
                name="avatar_url"
                accept="image/*"
                ref={avatarInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setAvatarFile(file);
                  formik.setFieldValue('avatar_url', file ? file.name : '');
                }}
                className="mt-3"
              />
              <Field as={Input} label={t('actors.nationalityLabel')} name="nationality" className="mt-3" />
              <Field as={DateInput} label={t('actors.dobLabel')} name="dob" id="dob" className="mt-3" />
              <Field as={Textarea} label={t('actors.bioLabel')} name="bio" className="mt-3" />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={createActorMutation.isPending}>
                  {t('actors.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
};
export default Add;
