import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import type { Cinema } from '@/types/entities';
import type { ComboFormValues } from '../../types/owner.types';
import { COMBO_TYPE_LABEL_KEY, COMBO_TYPE_OPTIONS, emptyComboForm, validateComboForm } from '../constants';
import { ComboItemsField } from './ComboItemsField';

interface ComboFormModalProps {
  cinemas: Cinema[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: ComboFormValues, helpers: FormikHelpers<ComboFormValues>) => Promise<void>;
}

export function ComboFormModal({ cinemas, isSubmitting, onClose, onSubmit }: ComboFormModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('combos.addTitle')}>
      <Formik<ComboFormValues>
        initialValues={emptyComboForm()}
        validate={(values) => validateComboForm(values, t)}
        onSubmit={onSubmit}
      >
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Select}
                label={t('combos.cinemaLabel')}
                name="cinema_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('combos.cinemaPlaceholder')}
                error={showErrors ? formik.errors.cinema_id : undefined}
              />
              <Field
                as={Input}
                label={t('combos.nameLabel')}
                name="name"
                className="mt-3"
                error={showErrors ? formik.errors.name : undefined}
              />
              <Field
                as={Input}
                label={t('combos.descriptionLabel')}
                name="description"
                className="mt-3"
                error={showErrors ? formik.errors.description : undefined}
              />
              <Field
                as={Input}
                label={t('combos.priceLabel')}
                name="price"
                type="number"
                className="mt-3"
                error={showErrors ? formik.errors.price : undefined}
              />
              <Field
                as={Select}
                label={t('combos.typeLabel')}
                name="type"
                className="mt-3"
                options={COMBO_TYPE_OPTIONS.map((value) => ({
                  label: t(COMBO_TYPE_LABEL_KEY[value]),
                  value,
                }))}
              />
              <ComboItemsField
                cinemaId={formik.values.cinema_id}
                type={formik.values.type}
                items={formik.values.items}
                onChange={(items) => formik.setFieldValue('items', items)}
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isSubmitting}>
                  {t('combos.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
