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
import {
  useActivateCinema,
  useDisableCinema,
  useSetCinemaMaintenance,
  useDeleteCinema,
  useCreateBranchAdmin,
} from '../hooks/useCinemaModeration';
import { CINEMA_STATUS, CINEMA_STATUS_META } from '@/constants/cinemaStatus';
import type { CreateBranchAdminPayload } from '../types/cinemas.types';

const emptyBranchAdminForm = (): CreateBranchAdminPayload => ({
  email: '',
  password: '',
  name: '',
  phone: '',
  cinema_name: '',
  code: '',
  address: '',
  city: '',
});

function AdminCinemas() {
  const { t } = useTranslation('admin');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const { data, isLoading } = useAdminCinemas(page, DEFAULT_PAGE_SIZE);
  const cinemas = data?.data ?? [];
  const activateMutation = useActivateCinema();
  const disableMutation = useDisableCinema();
  const maintenanceMutation = useSetCinemaMaintenance();
  const deleteMutation = useDeleteCinema();
  const createBranchAdminMutation = useCreateBranchAdmin();

  const statusVersion = useAppSelector((state) => state.realtime.cinemaStatusVersion);
  useEffect(() => {
    if (statusVersion > 0) queryClient.invalidateQueries({ queryKey: adminCinemasQueryKey });
  }, [statusVersion, queryClient]);

  const handleActivate = useCallback(
    async (id: number) => {
      try {
        await activateMutation.mutateAsync(id);
        toast.success(t('cinemas.activateSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [activateMutation, t],
  );

  const handleDisable = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('cinemas.disableConfirm')))) return;
      try {
        await disableMutation.mutateAsync(id);
        toast.success(t('cinemas.disableSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [disableMutation, t],
  );

  const handleMaintenance = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('cinemas.maintenanceConfirm')))) return;
      try {
        await maintenanceMutation.mutateAsync(id);
        toast.success(t('cinemas.maintenanceSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [maintenanceMutation, t],
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
      if (!values.code) errors.code = t('cinemas.addBranchAdmin.validation.codeRequired');
      return errors;
    },
    [t],
  );

  return (
    <AdminLayout breadcrumb={t('cinemas.breadcrumb')} loading={isLoading}>
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
      )}

      <div className="mt-6">
      <DataTable headers={t('cinemas.headers', { returnObjects: true }) as unknown as string[]}>
        {cinemas.map((cinema) => {
          const status = CINEMA_STATUS_META[cinema.status] || CINEMA_STATUS_META[CINEMA_STATUS.active];
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
                {cinema.status !== CINEMA_STATUS.active && (
                  <button
                    type="button"
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                    onClick={() => handleActivate(cinema.id)}
                  >
                    {t('cinemas.activateButton')}
                  </button>
                )}
                {cinema.status !== CINEMA_STATUS.inactive && (
                  <button
                    type="button"
                    className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                    onClick={() => handleDisable(cinema.id)}
                  >
                    {t('cinemas.disableButton')}
                  </button>
                )}
                {cinema.status !== CINEMA_STATUS.maintenance && (
                  <button
                    type="button"
                    className="text-sm font-medium text-amber-400 transition-colors hover:text-amber-300"
                    onClick={() => handleMaintenance(cinema.id)}
                  >
                    {t('cinemas.maintenanceButton')}
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
