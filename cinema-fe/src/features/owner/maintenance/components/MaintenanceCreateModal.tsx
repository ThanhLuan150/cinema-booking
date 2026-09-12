import { Formik, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { MAINTENANCE_RESOURCE_TYPE } from '@/constants/maintenanceResourceType';
import type { MaintenanceRequestFormValues } from '../../types/owner.types';
import { emptyForm } from '../constants';
import { MaintenanceCreateFields } from './MaintenanceCreateFields';

interface MaintenanceCreateModalProps {
  selectedbranchId: string;
  isEmployee: boolean;
  onClose: () => void;
  onSubmit: (values: MaintenanceRequestFormValues, helpers: FormikHelpers<MaintenanceRequestFormValues>) => void | Promise<void>;
  validate: (values: MaintenanceRequestFormValues) => Partial<Record<keyof MaintenanceRequestFormValues, string>>;
}

export function MaintenanceCreateModal({ selectedbranchId, isEmployee, onClose, onSubmit, validate }: MaintenanceCreateModalProps) {
  const { t } = useTranslation('owner');
  return (
    <Modal open onClose={onClose} title={t('maintenance.addTitle')}>
      <Formik<MaintenanceRequestFormValues>
        initialValues={emptyForm(selectedbranchId)}
        enableReinitialize
        validate={validate}
        onSubmit={onSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          const isRoom = formik.values.resource_type === MAINTENANCE_RESOURCE_TYPE.ROOM;
          const isSeat = formik.values.resource_type === MAINTENANCE_RESOURCE_TYPE.SEAT;
          return (
            <MaintenanceCreateFields
              formik={formik}
              showErrors={showErrors}
              isRoom={isRoom}
              isSeat={isSeat}
              isEmployee={isEmployee}
            />
          );
        }}
      </Formik>
    </Modal>
  );
}
