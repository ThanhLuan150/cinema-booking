import { useMemo } from 'react';
import { Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { MAINTENANCE_RESOURCE_TYPE } from '@/constants/maintenanceResourceType';
import { useMyCinemas } from '../../hooks/useMyCinemas';
import { useRoomsByCinema } from '../../hooks/useRoomsByCinema';
import { useSeatsByRoom } from '../../hooks/useSeatsByRoom';
import type { MaintenanceRequestFormValues } from '../../types/owner.types';

interface MaintenanceCreateFieldsProps {
  formik: {
    values: MaintenanceRequestFormValues;
    errors: Partial<Record<keyof MaintenanceRequestFormValues, string>>;
    isSubmitting: boolean;
    setFieldValue: (field: string, value: unknown) => void;
  };
  showErrors: boolean;
  isRoom: boolean;
  isSeat: boolean;
  isEmployee: boolean;
}

// Split out so the resource_type-dependent Room/Seat pickers can call the branch/room-scoped
// hooks conditionally without violating the rules of hooks in the parent render. `formik` is
// passed down from the parent's <Formik> render-prop, so its own onSubmit mutation (and
// isSubmitting) stays the single source of truth — this component never starts a second one.
export function MaintenanceCreateFields({ formik, showErrors, isRoom, isSeat, isEmployee }: MaintenanceCreateFieldsProps) {
  const { t } = useTranslation('owner');
  // Same 403-avoidance as the parent: an Employee can't list cinemas, but their branch_id is
  // already fixed (initialValues), so the field is just hidden rather than fetched for nothing.
  const { data: cinemasPage } = useMyCinemas({ enabled: !isEmployee });
  const cinemas = useMemo(() => cinemasPage?.data ?? [], [cinemasPage]);
  const { data: roomsPage } = useRoomsByCinema(formik.values.branch_id || undefined);
  const rooms = useMemo(() => roomsPage?.data ?? [], [roomsPage]);
  const { data: seats } = useSeatsByRoom(isSeat ? formik.values.room_id || undefined : undefined);

  const resourceTypeOptions = Object.values(MAINTENANCE_RESOURCE_TYPE).map((type) => ({
    label: t(`maintenance.resourceType.${type}`),
    value: type,
  }));

  return (
    <Form>
      {!isEmployee && (
        <Field
          as={Select}
          label={t('maintenance.branchLabel')}
          name="branch_id"
          options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
          placeholder={t('maintenance.branchPlaceholder')}
          error={showErrors ? formik.errors.branch_id : undefined}
        />
      )}
      <Field
        as={Select}
        label={t('maintenance.resourceTypeLabel')}
        name="resource_type"
        className="mt-3"
        options={resourceTypeOptions}
        onChange={(e: { target: { value: string } }) => {
          formik.setFieldValue('resource_type', e.target.value);
          formik.setFieldValue('room_id', '');
          formik.setFieldValue('seat_id', '');
        }}
      />
      {(isRoom || isSeat) && (
        <Field
          as={Select}
          label={t('maintenance.roomLabel')}
          name="room_id"
          className="mt-3"
          options={rooms.map((r) => ({ label: r.name, value: r.id }))}
          placeholder={t('maintenance.roomPlaceholder')}
          error={showErrors ? formik.errors.room_id : undefined}
          onChange={(e: { target: { value: string } }) => {
            formik.setFieldValue('room_id', e.target.value);
            formik.setFieldValue('seat_id', '');
          }}
        />
      )}
      {isSeat && (
        <Field
          as={Select}
          label={t('maintenance.seatLabel')}
          name="seat_id"
          className="mt-3"
          options={(seats ?? []).map((s) => ({ label: s.seat_code, value: s.id }))}
          placeholder={t('maintenance.seatPlaceholder')}
          error={showErrors ? formik.errors.seat_id : undefined}
        />
      )}
      {!isRoom && !isSeat && (
        <>
          <Field
            as={Select}
            label={t('maintenance.roomOptionalLabel')}
            name="room_id"
            className="mt-3"
            options={rooms.map((r) => ({ label: r.name, value: r.id }))}
            placeholder={t('maintenance.roomOptionalPlaceholder')}
          />
          <Field
            as={Input}
            label={t('maintenance.resourceNameLabel')}
            name="resource_name"
            className="mt-3"
            error={showErrors ? formik.errors.resource_name : undefined}
          />
        </>
      )}
      <Field
        as={Input}
        label={t('maintenance.titleLabel')}
        name="title"
        className="mt-3"
        error={showErrors ? formik.errors.title : undefined}
      />
      <Field as={Textarea} label={t('maintenance.descriptionLabel')} name="description" className="mt-3" rows={2} />
      <div className="mt-6 flex justify-end">
        <Button type="submit" variant="danger" loading={formik.isSubmitting}>
          {t('maintenance.submit')}
        </Button>
      </div>
    </Form>
  );
}
