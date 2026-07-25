import { Formik, Field, Form, type FormikProps, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useRoomsByCinema } from '@/features/owner/hooks/useRoomsByCinema';
import { SHOWTIME_SLOTS } from '../constants';
import { useCreateSchedule } from '../hooks/useCreateSchedule';
import type { ScheduleFormValues } from '../types/adminSchedule.types';
import { ROUTES } from '@/constants/routes';

export interface AddScheduleProps {
  id: number | string | null;
  handleCloseAddSchedule: () => void;
}

interface AddScheduleFormValues extends ScheduleFormValues {
  cinema_id: string;
}

const emptyValues = (): AddScheduleFormValues => ({
  cinema_id: '',
  room_id: '',
  movie_date: '',
  time_begin: '',
  time_end: '',
  price: '',
});

function ScheduleFields({
  formik,
  cinemas,
  createScheduleLoading,
  t,
}: {
  formik: FormikProps<AddScheduleFormValues>;
  cinemas: { id: number | string; name: string }[];
  createScheduleLoading: boolean;
  t: (key: string) => string;
}) {
  const { data: rooms = [] } = useRoomsByCinema(formik.values.cinema_id || undefined);

  const selectedSlotIndex = SHOWTIME_SLOTS.findIndex(
    (slot) => slot.time_begin === formik.values.time_begin && slot.time_end === formik.values.time_end,
  );

  const handleCinemaChange = (e: { target: { value: string } }) => {
    formik.setFieldValue('cinema_id', e.target.value);
    formik.setFieldValue('room_id', '');
  };

  const handleSlotChange = (e: { target: { value: string } }) => {
    const slot = SHOWTIME_SLOTS[Number(e.target.value)];
    if (!slot) return;
    formik.setFieldValue('time_begin', slot.time_begin);
    formik.setFieldValue('time_end', slot.time_end);
  };

  return (
    <Form>
      <Select
        label={t('schedules.add.cinema.label')}
        name="cinema_id"
        value={formik.values.cinema_id}
        onChange={handleCinemaChange}
        options={cinemas.map((cinema) => ({ label: cinema.name, value: cinema.id }))}
        placeholder={t('schedules.add.cinema.placeholder')}
      />
      <div className="mt-3">
        <Select
          label={t('schedules.add.room.label')}
          name="room_id"
          value={formik.values.room_id}
          onChange={formik.handleChange}
          options={rooms.map((room) => ({ label: room.name, value: room.id }))}
          placeholder={
            formik.values.cinema_id ? t('schedules.add.room.placeholder') : t('schedules.add.room.placeholderSelectCinemaFirst')
          }
          disabled={!formik.values.cinema_id}
        />
      </div>
      <Field as={Input} label={t('schedules.add.date')} type="date" id="date" name="movie_date" className="mt-3" />
      <div className="mt-3">
        <Select
          label={t('schedules.add.slot.label')}
          name="slot"
          value={selectedSlotIndex >= 0 ? selectedSlotIndex : ''}
          onChange={handleSlotChange}
          options={SHOWTIME_SLOTS.map((slot, index) => ({
            label: `${slot.time_begin} - ${slot.time_end}`,
            value: index,
          }))}
          placeholder={t('schedules.add.slot.placeholder')}
        />
      </div>
      <Field as={Input} label={t('schedules.add.price')} name="price" type="number" className="mt-3" />
      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="danger" loading={createScheduleLoading}>
          {t('schedules.add.submit')}
        </Button>
      </div>
    </Form>
  );
}

const Add = ({ id, handleCloseAddSchedule }: AddScheduleProps) => {
  const { t } = useTranslation('admin');
  const { data: cinemas = [] } = useMyCinemas();
  const createScheduleMutation = useCreateSchedule();

  const handleSubmit = async (
    values: AddScheduleFormValues,
    { resetForm }: FormikHelpers<AddScheduleFormValues>,
  ) => {
    if (!id || !values.room_id || !values.movie_date || !values.time_begin) {
      toast.error(t('schedules.add.validationError'));
      return;
    }
    const { cinema_id: _cinema_id, ...form } = values;
    try {
      await createScheduleMutation.mutateAsync({ movieId: id, values: form });
      toast.success(t('schedules.add.toastSuccess'));
      resetForm();
      setTimeout(() => {
        window.location.href = ROUTES.adminSchedules;
      }, 100);
    } catch (error) {
      console.log('Error adding schedule: ', error);
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={handleCloseAddSchedule} title={t('schedules.add.title')}>
      <Formik<AddScheduleFormValues> initialValues={emptyValues()} onSubmit={handleSubmit}>
        {(formik) => (
          <ScheduleFields formik={formik} cinemas={cinemas} createScheduleLoading={createScheduleMutation.isPending} t={t} />
        )}
      </Formik>
    </Modal>
  );
};
export default Add;
