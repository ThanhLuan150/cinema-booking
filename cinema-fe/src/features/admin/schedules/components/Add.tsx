import { Formik, Field, Form, type FormikProps, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useRoomsByCinema } from '@/features/owner/hooks/useRoomsByCinema';
import { useMovieDetail } from '@/features/movies/hooks/useMovieDetail';
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
  const {
    data: roomsPage,
    isFetching: roomsFetching,
    isFetched: roomsFetched,
  } = useRoomsByCinema(formik.values.cinema_id || undefined);
  const rooms = roomsPage?.data ?? [];

  const showNoRoomsHint = Boolean(formik.values.cinema_id) && roomsFetched && !roomsFetching && rooms.length === 0;

  const selectedSlotIndex = SHOWTIME_SLOTS.findIndex(
    (slot) => slot.time_begin === formik.values.time_begin && slot.time_end === formik.values.time_end,
  );

  const showErrors = formik.submitCount > 0;

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
        error={showErrors && formik.errors.cinema_id ? t('schedules.add.cinema.required') : undefined}
      />
      <div className="mt-3">
        <Select
          label={t('schedules.add.room.label')}
          name="room_id"
          value={formik.values.room_id}
          onChange={formik.handleChange}
          options={rooms.map((room) => ({ label: room.name, value: room.id }))}
          placeholder={
            !formik.values.cinema_id
              ? t('schedules.add.room.placeholderSelectCinemaFirst')
              : showNoRoomsHint
                ? t('schedules.add.room.placeholderNoRooms')
                : t('schedules.add.room.placeholder')
          }
          disabled={!formik.values.cinema_id || showNoRoomsHint}
          error={showErrors && formik.errors.room_id ? t('schedules.add.room.required') : undefined}
        />
        {showNoRoomsHint && (
          <p className="mt-1 text-sm text-red-400">
            {t('schedules.add.room.noRoomsHint')}{' '}
            <Link to={ROUTES.ownerCinemaRooms(formik.values.cinema_id)} className="text-accent underline">
              {t('schedules.add.room.noRoomsHintLink')}
            </Link>
          </p>
        )}
      </div>
      <Field
        as={Input}
        label={t('schedules.add.date')}
        type="date"
        id="date"
        name="movie_date"
        className="mt-3"
        error={showErrors && formik.errors.movie_date ? t('schedules.add.dateRequired') : undefined}
      />
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
          error={showErrors && formik.errors.time_begin ? t('schedules.add.slot.required') : undefined}
        />
      </div>
      <Field
        as={Input}
        label={t('schedules.add.price')}
        name="price"
        type="number"
        className="mt-3"
        error={showErrors && formik.errors.price ? t('schedules.add.priceRequired') : undefined}
      />
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
  const { data: allCinemasPage } = useMyCinemas();
  const allCinemas = allCinemasPage?.data ?? [];
  const { data: movie, isFetched: movieFetched } = useMovieDetail(id ?? undefined);
  const createScheduleMutation = useCreateSchedule();

  // Movies added by a cinema owner should only be schedulable at that owner's own branches.
  // Movies with no owner (owner_id null — seeded/legacy, or added directly by admin without
  // an owning branch) fall back to showing every branch.
  const cinemas =
    !movieFetched || movie?.owner_id == null ? allCinemas : allCinemas.filter((cinema) => cinema.owner_id === movie.owner_id);

  const validate = (values: AddScheduleFormValues) => {
    const errors: Partial<Record<keyof AddScheduleFormValues, string>> = {};
    if (!values.cinema_id) errors.cinema_id = 'required';
    if (!values.room_id) errors.room_id = 'required';
    if (!values.movie_date) errors.movie_date = 'required';
    if (!values.time_begin) errors.time_begin = 'required';
    if (values.price === '' || Number(values.price) <= 0) errors.price = 'required';
    return errors;
  };

  const handleSubmit = async (
    values: AddScheduleFormValues,
    { resetForm }: FormikHelpers<AddScheduleFormValues>,
  ) => {
    if (!id) return;
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
      <Formik<AddScheduleFormValues> initialValues={emptyValues()} validate={validate} onSubmit={handleSubmit}>
        {(formik) => (
          <ScheduleFields formik={formik} cinemas={cinemas} createScheduleLoading={createScheduleMutation.isPending} t={t} />
        )}
      </Formik>
    </Modal>
  );
};
export default Add;
