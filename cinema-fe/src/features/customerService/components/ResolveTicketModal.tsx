import { Formik, Field, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';

export function ResolveTicketModal({
  onClose,
  onSubmit,
  submitPending,
}: {
  onClose: () => void;
  onSubmit: (values: { resolution_note: string }) => void | Promise<void>;
  submitPending: boolean;
}) {
  const { t } = useTranslation('customerService');
  return (
    <Modal open onClose={onClose} title={t('resolveTitle')}>
      <Formik initialValues={{ resolution_note: '' }} onSubmit={onSubmit}>
        <Form>
          <Field as={Textarea} label={t('resolutionNoteLabel')} name="resolution_note" rows={3} />
          <div className="mt-6 flex justify-end">
            <Button type="submit" variant="danger" loading={submitPending}>
              {t('submit')}
            </Button>
          </div>
        </Form>
      </Formik>
    </Modal>
  );
}
