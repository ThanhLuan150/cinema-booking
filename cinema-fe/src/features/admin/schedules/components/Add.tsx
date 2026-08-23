import { useEffect } from 'react';
import { Formik, Field, Form, type FormikProps, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { useMyCinemas } from '@/features/owner/hooks/useMyCinemas';
import { useRoomsByCinema } from '@/features/owner/hooks/useRoomsByCinema';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { useMyMovies } from '../../movies/hooks/useMyMovies';
import { SHOWTIME_SLOTS } from '../constants';
import { useCreateSchedule } from '../hooks/useCreateSchedule';
import { useSchedules } from '../hooks/useSchedules';
import { isSlotBlocked } from '../utils/slotConflict';
import type { ScheduleFormValues } from '../types/adminSchedule.types';
import { ROUTES } from '@/constants/routes';

export interface AddScheduleProps {
  // A preset movie (opened from a specific movie's row) or null (opened from the Showtime
  // page's own "Add Showtime" button, which then requires picking an ACTIVE movie below).
  id: number | string | null;
  handleCloseAddSchedule: () => void;
}

interface AddScheduleFormValues extends ScheduleFormValues {
  movie_id: string;
  cinema_id: string;
}

const emptyValues = (presetMovieId: number | string | null): AddScheduleFormValues => ({
  movie_id: presetMovieId != null ? String(presetMovieId) : '',
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
  showMoviePicker,
  createScheduleLoading,
  t,
}: {
  formik: FormikProps<AddScheduleFormValues>;
  cinemas: { id: number | string; name: string }[];
  showMoviePicker: boolean;
  createScheduleLoading: boolean;
  t: (key: string) => string;
}) {
  const { data: activeMoviesPage } = useMyMovies(1, FULL_LIST_FETCH_LIMIT, 'ACTIVE');
  const activeMovies = activeMoviesPage?.data ?? [];

  const {
    data: roomsPage,
    isFetching: roomsFetching,
    isFetched: roomsFetched,
  } = useRoomsByCinema(formik.values.cinema_id || undefined);
  const rooms = roomsPage?.data ?? [];

  const showNoRoomsHint = Boolean(formik.values.cinema_id) && roomsFetched && !roomsFetching && rooms.length === 0;

  const { data: roomSchedulesPage } = useSchedules(
    { roomId: formik.values.room_id || undefined },
    1,
    FULL_LIST_FETCH_LIMIT,
    Boolean(formik.values.room_id),
  );
  const schedulesOnDate = (roomSchedulesPage?.data ?? []).filter(
    (schedule) => schedule.movie_date === formik.values.movie_date,
  );

  const slotOptions = SHOWTIME_SLOTS.map((slot, index) => {
    const blocked = isSlotBlocked(slot.time_begin, slot.time_end, schedulesOnDate);
    return {
      label: `${slot.time_begin} - ${slot.time_end}${blocked ? ` (${t('schedules.add.slot.unavailable')})` : ''}`,
      value: index,
      disabled: blocked,
    };
  });

  const selectedSlotIndex = SHOWTIME_SLOTS.findIndex(
    (slot) => slot.time_begin === formik.values.time_begin && slot.time_end === formik.values.time_end,
  );

  useEffect(() => {
    if (selectedSlotIndex < 0) return;
    if (isSlotBlocked(formik.values.time_begin, formik.values.time_end, schedulesOnDate)) {
      formik.setFieldValue('time_begin', '');
      formik.setFieldValue('time_end', '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.room_id, formik.values.movie_date]);

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
      {showMoviePicker && (
        <Select
          label={t('schedules.add.movie.label')}
          name="movie_id"
          value={formik.values.movie_id}
          onChange={formik.handleChange}
          options={activeMovies.map((movie) => ({ label: movie.name, value: movie.id }))}
          placeholder={t('schedules.add.movie.placeholder')}
          error={showErrors && formik.errors.movie_id ? t('schedules.add.movie.required') : undefined}
          className="mb-3"
        />
      )}
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
        as={DateInput}
        label={t('schedules.add.date')}
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
          options={slotOptions}
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
  // The Movie is company-wide (no branch affinity), so every branch the caller can act on
  // is a valid choice — useMyCinemas already scopes this to "all" for super admin or the
  // branch admin's own branch(es).
  const { data: allCinemasPage } = useMyCinemas();
  const cinemas = allCinemasPage?.data ?? [];
  const createScheduleMutation = useCreateSchedule();

  const validate = (values: AddScheduleFormValues) => {
    const errors: Partial<Record<keyof AddScheduleFormValues, string>> = {};
    if (!values.movie_id) errors.movie_id = 'required';
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
    const movieId = id ?? values.movie_id;
    if (!movieId) return;
    const { cinema_id: _cinema_id, movie_id: _movie_id, ...form } = values;
    try {
      await createScheduleMutation.mutateAsync({ movieId, values: form });
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
      <Formik<AddScheduleFormValues>
        initialValues={emptyValues(id)}
        validate={validate}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <ScheduleFields
            formik={formik}
            cinemas={cinemas}
            showMoviePicker={id == null}
            createScheduleLoading={createScheduleMutation.isPending}
            t={t}
          />
        )}
      </Formik>
    </Modal>
  );
};
export default Add;
