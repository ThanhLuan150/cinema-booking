import { useCallback, useRef, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useActors } from '../hooks/useActors';
import { useCreateActor, useDeleteActor } from '../hooks/useActorMutations';
import { closeAddModal, openAddModal } from '../store/adminActorsSlice';
import type { ActorFormValues } from '../types/actor.types';

const emptyForm = (): ActorFormValues => ({ full_name: '', avatar_url: '', bio: '', dob: '', nationality: '' });

function ActorList() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data } = useActors(page, DEFAULT_PAGE_SIZE);
  const actors = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.adminActors);
  const createActorMutation = useCreateActor();
  const deleteActorMutation = useDeleteActor();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('actors.deleteConfirm')))) return;
      try {
        await deleteActorMutation.mutateAsync(id);
        toast.success(t('actors.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteActorMutation, t],
  );

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
    <AdminLayout breadcrumb={t('actors.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('actors.addButton')}
      </Button>

      {showAddModal && (
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
                  <Field as={Input} label={t('actors.dobLabel')} name="dob" type="date" className="mt-3" />
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
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('actors.headers.id'),
            t('actors.headers.fullName'),
            t('actors.headers.nationality'),
            t('actors.headers.actions'),
          ]}
        >
          {actors.map((actor) => (
            <tr key={actor.id}>
              <td>{actor.id}</td>
              <td>{actor.full_name}</td>
              <td>{actor.nationality}</td>
              <td>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(actor.id)}
                >
                  {t('actors.delete')}
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
        <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default ActorList;
