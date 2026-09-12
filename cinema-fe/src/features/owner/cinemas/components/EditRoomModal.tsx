import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Room } from '@/types/entities';
import type { RoomFormValues } from '../../types/owner.types';

const editRoomFormValues = (room: Room): RoomFormValues => ({
  name: room.name,
  code: room.code,
  type: room.type,
  capacity: String(room.capacity),
  status: room.status,
});

interface EditRoomModalProps {
  room: Room;
  onClose: () => void;
  onSubmit: (values: RoomFormValues) => Promise<void>;
  validate: (values: RoomFormValues) => Partial<Record<keyof RoomFormValues, string>>;
  roomTypeOptions: { label: string; value: string }[];
  roomStatusOptions: { label: string; value: string }[];
  isPending: boolean;
}

export function EditRoomModal({
  room,
  onClose,
  onSubmit,
  validate,
  roomTypeOptions,
  roomStatusOptions,
  isPending,
}: EditRoomModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('rooms.editTitle')}>
      <Formik<RoomFormValues> initialValues={editRoomFormValues(room)} validate={validate} onSubmit={onSubmit}>
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Input}
                label={t('rooms.nameLabel')}
                name="name"
                error={showErrors ? formik.errors.name : undefined}
              />
              <Field
                as={Input}
                label={t('rooms.codeLabel')}
                name="code"
                className="mt-3"
                error={showErrors ? formik.errors.code : undefined}
              />
              <Field
                as={Select}
                label={t('rooms.typeLabel')}
                name="type"
                className="mt-3"
                options={roomTypeOptions}
              />
              <Field
                as={Input}
                label={t('rooms.capacityLabel')}
                name="capacity"
                type="number"
                className="mt-3"
                error={showErrors ? formik.errors.capacity : undefined}
              />
              <Field
                as={Select}
                label={t('rooms.statusLabel')}
                name="status"
                className="mt-3"
                options={roomStatusOptions}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isPending}>
                  {t('rooms.saveButton')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
