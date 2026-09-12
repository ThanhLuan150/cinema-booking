import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';

interface MaintenanceResolveModalProps {
  loading: boolean;
  onClose: () => void;
  onSubmit: (values: { resolution_note: string }) => void | Promise<void>;
}

export function MaintenanceResolveModal({ loading, onClose, onSubmit }: MaintenanceResolveModalProps) {
  const { t } = useTranslation('owner');
  return (
    <Modal open onClose={onClose} title={t('maintenance.resolveTitle')}>
      <Formik initialValues={{ resolution_note: '' }} onSubmit={onSubmit}>
        <Form>
          <Field as={Textarea} label={t('maintenance.resolutionNoteLabel')} name="resolution_note" rows={3} />
          <div className="mt-6 flex justify-end">
            <Button type="submit" variant="danger" loading={loading}>
              {t('maintenance.submit')}
            </Button>
          </div>
        </Form>
      </Formik>
    </Modal>
  );
}
