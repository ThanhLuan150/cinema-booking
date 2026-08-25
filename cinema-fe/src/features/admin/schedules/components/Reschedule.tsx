import { Formik, Form, type FormikProps, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { toast } from '@/features/notifications/toast';
import { getApiErrorMessage } from '@/lib/apiError';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';
import { SHOWTIME_SLOTS } from '../constants';
import { useSchedules } from '../hooks/useSchedules';
import { useRescheduleSchedule } from '../hooks/useRescheduleSchedule';
import { isSlotBlocked } from '../utils/slotConflict';
import type { Schedule } from '../types/adminSchedule.types';

export interface RescheduleProps {
  schedule: Schedule;
  onClose: () => void;
}

interface RescheduleFormValues {
  movie_date: string;
  time_begin: string;
  time_end: string;
}

function RescheduleFields({
  formik,
  schedule,
  rescheduleLoading,
  t,
}: {
  formik: FormikProps<RescheduleFormValues>;
  schedule: Schedule;
  rescheduleLoading: boolean;
  t: (key: string) => string;
}) {
  const { data: roomSchedulesPage } = useSchedules({ roomId: schedule.room_id }, 1, FULL_LIST_FETCH_LIMIT);
  const schedulesOnDate = (roomSchedulesPage?.data ?? []).filter(
    (candidate) => candidate.id !== schedule.id && candidate.movie_date === formik.values.movie_date,
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

  const handleSlotChange = (e: { target: { value: string } }) => {
    const slot = SHOWTIME_SLOTS[Number(e.target.value)];
    if (!slot) return;
    formik.setFieldValue('time_begin', slot.time_begin);
    formik.setFieldValue('time_end', slot.time_end);
  };

  const showErrors = formik.submitCount > 0;

  return (
    <Form>
      <p className="mb-3 text-sm text-txt/70">
        {t('schedules.reschedule.currentTime')}: {schedule.movie_date} · {schedule.time_begin} - {schedule.time_end}
      </p>
      <DateInput
        label={t('schedules.add.date')}
        id="reschedule_date"
        name="movie_date"
        value={formik.values.movie_date}
        onChange={(e) => formik.setFieldValue('movie_date', e.target.value)}
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
      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="danger" loading={rescheduleLoading}>
          {t('schedules.reschedule.submit')}
        </Button>
      </div>
    </Form>
  );
}

const Reschedule = ({ schedule, onClose }: RescheduleProps) => {
  const { t } = useTranslation('admin');
  const rescheduleMutation = useRescheduleSchedule();

  const validate = (values: RescheduleFormValues) => {
    const errors: Partial<Record<keyof RescheduleFormValues, string>> = {};
    if (!values.movie_date) errors.movie_date = 'required';
    if (!values.time_begin) errors.time_begin = 'required';
    return errors;
  };

  const handleSubmit = async (values: RescheduleFormValues, { resetForm }: FormikHelpers<RescheduleFormValues>) => {
    if (values.movie_date === schedule.movie_date && values.time_begin === schedule.time_begin) {
      toast.error(t('schedules.reschedule.noChange'));
      return;
    }
    try {
      await rescheduleMutation.mutateAsync({ id: schedule.id, payload: values });
      toast.success(t('schedules.reschedule.toastSuccess'));
      resetForm();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t));
    }
  };

  return (
    <Modal open onClose={onClose} title={t('schedules.reschedule.title')}>
      <Formik<RescheduleFormValues>
        initialValues={{ movie_date: schedule.movie_date, time_begin: '', time_end: '' }}
        validate={validate}
        onSubmit={handleSubmit}
      >
        {(formik) => (
          <RescheduleFields formik={formik} schedule={schedule} rescheduleLoading={rescheduleMutation.isPending} t={t} />
        )}
      </Formik>
    </Modal>
  );
};
export default Reschedule;
