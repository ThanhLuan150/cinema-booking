import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import type { User } from '@/types/entities';
import { CATEGORIES } from '../constants';
import type { CreateTicketFormValues } from '../types/customerService.types';
import { CustomerPicker } from './CustomerPicker';

export function CreateTicketModal({
  createCustomer,
  onSelectCustomer,
  onClose,
  onSubmit,
  submitPending,
}: {
  createCustomer: User | null;
  onSelectCustomer: (customer: User | null) => void;
  onClose: () => void;
  onSubmit: (values: CreateTicketFormValues, helpers: FormikHelpers<CreateTicketFormValues>) => void | Promise<void>;
  submitPending: boolean;
}) {
  const { t } = useTranslation('customerService');
  const categoryOptions = CATEGORIES.map((category) => ({ label: t(`category.${category}`), value: category }));

  return (
    <Modal open onClose={onClose} title={t('createTitle')}>
      <CustomerPicker selected={createCustomer} onSelect={onSelectCustomer} />
      <Formik<CreateTicketFormValues>
        initialValues={{ subject: '', description: '', category: 'GENERAL' }}
        validate={(values) => {
          const errors: Partial<Record<keyof CreateTicketFormValues, string>> = {};
          if (!values.subject.trim()) errors.subject = t('validation.subjectRequired');
          return errors;
        }}
        onSubmit={onSubmit}
      >
        {(formik) => (
          <Form>
            <Field as={Select} label={t('categoryLabel')} name="category" className="mt-3" options={categoryOptions} />
            <Field
              as={Input}
              label={t('subjectLabel')}
              name="subject"
              className="mt-3"
              error={formik.submitCount > 0 ? formik.errors.subject : undefined}
            />
            <Field as={Textarea} label={t('descriptionLabel')} name="description" className="mt-3" rows={3} />
            <div className="mt-6 flex justify-end">
              <Button type="submit" variant="danger" loading={submitPending} disabled={!createCustomer}>
                {t('submit')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
