import { useCallback, useMemo, useState } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { toast } from '@/features/notifications/toast';
import { confirmDialog } from '@/features/notifications/confirm';
import { getApiErrorMessage } from '@/lib/apiError';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAuthRole } from '@/features/auth/hooks/useAuth';
import { ROLES } from '@/constants/roles';
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useOwnerHolidays } from '../../hooks/useOwnerHolidays';
import { useCreateHoliday, useDeleteHoliday } from '../../hooks/useHolidayMutations';
import { closeAddModal, openAddModal } from '../../store/ownerHolidaysSlice';
import type { HolidayFormValues } from '../../types/owner.types';

const ALL_BRANCHES = 'ALL';

function emptyHolidayForm(branchId: string): HolidayFormValues {
  return { date: '', name: '', branch_id: branchId };
}

function HolidayList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const isAdmin = useAuthRole() === ROLES.admin;

  const [page, setPage] = useState(1);

  const { data: cinemasPage } = useMyCinemas();
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const branchNameById = useMemo(() => new Map(cinemas.map((c) => [c.id, c.name])), [cinemas]);

  const defaultBranchId = isAdmin ? '' : cinemas.length > 0 ? String(cinemas[0].id) : '';

  const { data, isLoading } = useOwnerHolidays(undefined, page, DEFAULT_PAGE_SIZE);
  const holidays = data?.data ?? [];
  const { showAddModal } = useAppSelector((state) => state.ownerHolidays);
  const createHolidayMutation = useCreateHoliday();
  const deleteHolidayMutation = useDeleteHoliday();

  const branchOptions = useMemo(() => {
    const options = cinemas.map((c) => ({ label: c.name, value: String(c.id) }));
    return [{ label: t('holidays.allBranchesOption'), value: ALL_BRANCHES }, ...options];
  }, [cinemas, t]);

  const handleCreate = useCallback(
    async (values: HolidayFormValues, { resetForm }: FormikHelpers<HolidayFormValues>) => {
      try {
        await createHolidayMutation.mutateAsync({
          date: values.date,
          name: values.name,
          branch_id: values.branch_id === ALL_BRANCHES ? null : Number(values.branch_id),
        });
        toast.success(t('holidays.createSuccess'));
        resetForm();
        dispatch(closeAddModal());
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [createHolidayMutation, dispatch, t],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!(await confirmDialog(t('holidays.deleteConfirm')))) return;
      try {
        await deleteHolidayMutation.mutateAsync(id);
        toast.success(t('holidays.deleteSuccess'));
      } catch (error) {
        toast.error(getApiErrorMessage(error, t));
      }
    },
    [deleteHolidayMutation, t],
  );

  return (
    <AdminLayout breadcrumb={t('holidays.breadcrumb')} loading={isLoading}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddModal())}>
        {t('holidays.addButton')}
      </Button>

      {showAddModal && (
        <Modal open onClose={() => dispatch(closeAddModal())} title={t('holidays.addTitle')}>
          <Formik<HolidayFormValues>
            initialValues={emptyHolidayForm(defaultBranchId)}
            validate={(values) => {
              const errors: Partial<Record<keyof HolidayFormValues, string>> = {};
              if (!values.date) errors.date = t('holidays.validation.dateRequired');
              return errors;
            }}
            onSubmit={handleCreate}
          >
            {(formik) => {
              const showErrors = formik.submitCount > 0;
              return (
                <Form>
                  <Field
                    as={DateInput}
                    label={t('holidays.dateLabel')}
                    id="holiday-date"
                    name="date"
                    error={showErrors ? formik.errors.date : undefined}
                  />
                  <Field as={Input} label={t('holidays.nameLabel')} name="name" className="mt-3" />
                  <Field
                    as={Select}
                    label={t('holidays.branchLabel')}
                    name="branch_id"
                    className="mt-3"
                    options={branchOptions}
                  />
                  <div className="mt-6 flex justify-end">
                    <Button type="submit" variant="danger" loading={createHolidayMutation.isPending}>
                      {t('holidays.submit')}
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
            t('holidays.headers.id'),
            t('holidays.headers.date'),
            t('holidays.headers.name'),
            t('holidays.headers.branch'),
            t('holidays.headers.actions'),
          ]}
        >
          {holidays.map((holiday) => (
            <tr key={holiday.id}>
              <td>{holiday.id}</td>
              <td>{holiday.date}</td>
              <td>{holiday.name}</td>
              <td>
                {holiday.branch_id === null
                  ? t('holidays.allBranchesOption')
                  : branchNameById.get(holiday.branch_id) || holiday.branch_id}
              </td>
              <td>
                <button
                  type="button"
                  className="text-sm font-medium text-red-500 transition-colors hover:text-red-400"
                  onClick={() => handleDelete(holiday.id)}
                >
                  {t('holidays.delete')}
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

export default HolidayList;
