import { useCallback, useRef, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Textarea } from '@/components/ui/Textarea';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useDirectors } from '../hooks/useDirectors';
import { useCreateDirector, useDeleteDirector } from '../hooks/useDirectorMutations';
import { closeAddModal, openAddModal } from '../store/adminDirectorsSlice';
import type { DirectorFormValues } from '../types/director.types';

const emptyForm = (): DirectorFormValues => ({ full_name: '', avatar_url: '', bio: '', dob: '', nationality: '' });

function DirectorList() {
  const { t } = useTranslation('admin');
  const dispatch = useAppDispatch();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useDirectors(page, DEFAULT_PAGE_SIZE);
  const directors = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.adminDirectors);
  const createDirectorMutation = useCreateDirector();
  const deleteDirectorMutation = useDeleteDirector();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('directors.deleteConfirm')))) return;
      try {
        await deleteDirectorMutation.mutateAsync(id);
        toast.success(t('directors.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteDirectorMutation, t],
  );

  const handleSubmit = useCallback(
    async (values: DirectorFormValues, { resetForm }: FormikHelpers<DirectorFormValues>) => {
      try {
        await createDirectorMutation.mutateAsync({ ...values, avatarFile });
        if (avatarInputRef.current) avatarInputRef.current.value = '';
        setAvatarFile(null);
        toast.success(t('directors.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [avatarFile, createDirectorMutation, dispatch, t],
  );

  const validateDirector = useCallback(
    (values: DirectorFormValues) => {
      const errors: Partial<Record<keyof DirectorFormValues, string>> = {};
      if (!values.full_name.trim()) errors.full_name = t('directors.validation.fullNameRequired');
      return errors;
    },
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('directors.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('directors.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('directors.addTitle')}>
          <Formik<DirectorFormValues> initialValues={emptyForm()} validate={validateDirector} onSubmit={handleSubmit}>
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form encType="multipart/form-data">
                  <Field
                    as={Input}
                    label={t('directors.fullNameLabel')}
                    name="full_name"
                    error={showErrors ? formik.errors.full_name : undefined}
                  />
                  <Input
                    label={t('directors.avatarUrlLabel')}
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
                  <Field as={Input} label={t('directors.nationalityLabel')} name="nationality" className="mt-3" />
                  <Field as={DateInput} label={t('directors.dobLabel')} name="dob" id="dob" className="mt-3" />
                  <Field as={Textarea} label={t('directors.bioLabel')} name="bio" className="mt-3" />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createDirectorMutation.isPending}>
                      {t('directors.submit')}
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
            t('directors.headers.id'),
            t('directors.headers.fullName'),
            t('directors.headers.nationality'),
            t('directors.headers.actions'),
          ]}
        >
          {directors.map((director) => (
            <tr key={director.id}>
              <td>{director.id}</td>
              <td>{director.full_name}</td>
              <td>{director.nationality}</td>
              <td>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(director.id)}
                >
                  {t('directors.delete')}
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

export default DirectorList;
