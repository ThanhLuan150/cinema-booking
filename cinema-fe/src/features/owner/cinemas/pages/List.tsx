import { useEffect } from 'react';
import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { toast } from '@/features/notifications/toast';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { getApiErrorMessage } from '@/lib/apiError';
import { myCinemasQueryKey, useMyCinemas } from '../../hooks/useMyCinemas';
import { useCreateCinema } from '../../hooks/useCreateCinema';
import { closeAddCinemaModal, openAddCinemaModal } from '../../store/ownerCinemasSlice';
import type { CinemaFormValues } from '../../types/owner.types';
import { CINEMA_STATUS, CINEMA_STATUS_META } from '@/constants/cinemaStatus';
import { ROUTES } from '@/constants/routes';

const emptyCinemaForm = (): CinemaFormValues => ({ name: '', address: '', city: '' });

function CinemaList() {
  const { t } = useTranslation('owner');
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const STATUS_LABEL = t('cinemas.statusLabels', { returnObjects: true }) as unknown as string[];
  const { data: cinemasPage } = useMyCinemas();
  const cinemas = cinemasPage?.data ?? [];
  const { showAddCinemaModal } = useAppSelector((state) => state.ownerCinemas);
  const createCinemaMutation = useCreateCinema();

  const statusVersion = useAppSelector((state) => state.realtime.cinemaStatusVersion);
  useEffect(() => {
    if (statusVersion > 0) queryClient.invalidateQueries({ queryKey: myCinemasQueryKey });
  }, [statusVersion, queryClient]);

  const handleSubmit = async (values: CinemaFormValues, { resetForm }: FormikHelpers<CinemaFormValues>) => {
    try {
      await createCinemaMutation.mutateAsync(values);
      toast.success(t('cinemas.createSuccess'));
      resetForm();
      dispatch(closeAddCinemaModal());
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <AdminLayout breadcrumb={t('cinemas.breadcrumb')}>
      <Button type="button" variant="danger" onClick={() => dispatch(openAddCinemaModal())}>
        {t('cinemas.addButton')}
      </Button>

      {showAddCinemaModal && (
        <Modal open onClose={() => dispatch(closeAddCinemaModal())} title={t('cinemas.addTitle')}>
          <Formik<CinemaFormValues> initialValues={emptyCinemaForm()} onSubmit={handleSubmit}>
            <Form>
              <Field as={Input} label={t('cinemas.nameLabel')} name="name" required />
              <Field as={Input} label={t('cinemas.addressLabel')} name="address" className="mt-3" />
              <Field as={Input} label={t('cinemas.cityLabel')} name="city" className="mt-3" />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={createCinemaMutation.isPending}>
                  {t('cinemas.submit')}
                </Button>
              </div>
            </Form>
          </Formik>
        </Modal>
      )}

      <div className="mt-6">
        <DataTable
          headers={[
            t('cinemas.headers.id'),
            t('cinemas.headers.name'),
            t('cinemas.headers.address'),
            t('cinemas.headers.city'),
            t('cinemas.headers.status'),
            t('cinemas.headers.actions'),
          ]}
        >
          {cinemas.map((cinema) => {
            const statusText = STATUS_LABEL[cinema.status] ?? STATUS_LABEL[CINEMA_STATUS.pending];
            const statusClassName =
              CINEMA_STATUS_META[cinema.status]?.className ?? CINEMA_STATUS_META[CINEMA_STATUS.pending].className;
            return (
              <tr key={cinema.id}>
                <td>{cinema.id}</td>
                <td>{cinema.name}</td>
                <td>{cinema.address}</td>
                <td>{cinema.city}</td>
                <td>
                  <span className={`rounded px-2 py-0.5 text-xs ${statusClassName}`}>{statusText}</span>
                </td>
                <td>
                  <Link to={ROUTES.ownerCinemaRooms(cinema.id)} className="text-accent no-underline">
                    {t('cinemas.manageRooms')}
                  </Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
    </AdminLayout>
  );
}

export default CinemaList;
