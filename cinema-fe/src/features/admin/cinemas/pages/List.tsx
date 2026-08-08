import { useCallback, useEffect, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { useAppSelector } from '@/hooks/redux';
import { getApiErrorMessage } from '@/lib/apiError';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { adminCinemasQueryKey, useAdminCinemas } from '../hooks/useAdminCinemas';
import { useApproveCinema, useBlockCinema, useDeleteCinema, useCreateBranchAdmin } from '../hooks/useCinemaModeration';
import { CINEMA_STATUS, CINEMA_STATUS_META } from '@/constants/cinemaStatus';
import type { CreateBranchAdminPayload } from '../types/cinemas.types';

const emptyBranchAdminForm = (): CreateBranchAdminPayload => ({
  email: '',
  password: '',
  name: '',
  phone: '',
  cinema_name: '',
  address: '',
  city: '',
});

function AdminCinemas() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const { data } = useAdminCinemas(page, DEFAULT_PAGE_SIZE);
  const cinemas = data?.data ?? [];
  const approveMutation = useApproveCinema();
  const blockMutation = useBlockCinema();
  const deleteMutation = useDeleteCinema();
  const createBranchAdminMutation = useCreateBranchAdmin();

  const pendingVersion = useAppSelector((state) => state.realtime.cinemaPendingVersion);
  useEffect(() => {
    if (pendingVersion > 0) queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey });
  }, [pendingVersion, queryClient]);

  const handleApprove = useCallback(
    async (id: number) => {
      try {
        await approveMutation.mutateAsync(id);
        toast.success(t('cinemas.approveSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [approveMutation, t],
  );

  const handleBlock = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('cinemas.blockConfirm')))) return;
      try {
        await blockMutation.mutateAsync(id);
        toast.success(t('cinemas.blockSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [blockMutation, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('cinemas.deleteConfirm')))) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success(t('cinemas.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteMutation, t],
  );

  const handleCreateBranchAdmin = useCallback(
    async (values: CreateBranchAdminPayload, { resetForm }: FormikHelpers<CreateBranchAdminPayload>) => {
      try {
        await createBranchAdminMutation.mutateAsync(values);
        toast.success(t('cinemas.addBranchAdmin.success'));
        resetForm();
        setShowAddModal(false);
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createBranchAdminMutation, t],
  );

  const validateBranchAdmin = useCallback(
    (values: CreateBranchAdminPayload) => {
      const errors: Partial<Record<keyof CreateBranchAdminPayload, string>> = {};
      if (!values.email) errors.email = t('cinemas.addBranchAdmin.validation.emailRequired');
      if (!values.password || values.password.length < 6) {
        errors.password = t('cinemas.addBranchAdmin.validation.passwordInvalid');
      }
      if (!values.cinema_name) errors.cinema_name = t('cinemas.addBranchAdmin.validation.cinemaNameRequired');
      return errors;
    },
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('cinemas.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => setShowAddModal(true)}>
        {t('cinemas.addBranchAdmin.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => setShowAddModal(false)} title={t('cinemas.addBranchAdmin.title')}>
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
      )}

      <div className="mt-6">
      <DataTable headers={t('cinemas.headers', { returnObjects: true }) as unknown as string[]}>
        {cinemas.map((cinema) => {
          const status = CINEMA_STATUS_META[cinema.status] || CINEMA_STATUS_META[CINEMA_STATUS.pending];
          return (
            <tr key={cinema.id}>
              <td>{cinema.id}</td>
              <td>
                <Avatar src={cinema.owner_avatar} name={cinema.owner_name} size="sm" />
              </td>
              <td>{cinema.name}</td>
              <td>{cinema.owner_id}</td>
              <td>
                {cinema.address} {cinema.city}
              </td>
              <td>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${status.className}`}>
                  {t(`cinemas.status.${status.key}`)}
                </span>
              </td>
              <td className="flex gap-3">
                {cinema.status !== CINEMA_STATUS.approved && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleApprove(cinema.id)}
                  >
                    {t('cinemas.approveButton')}
                  </button>
                )}
                {cinema.status !== CINEMA_STATUS.blocked && (
                  <button
                    type="button"
                    className="text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
                    onClick={() => handleBlock(cinema.id)}
                  >
                    {t('cinemas.blockButton')}
                  </button>
                )}
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(cinema.id)}
                >
                  {t('cinemas.deleteButton')}
                </button>
              </td>
            </tr>
          );
        })}
      </DataTable>
      <Pagination page={page} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

export default AdminCinemas;
