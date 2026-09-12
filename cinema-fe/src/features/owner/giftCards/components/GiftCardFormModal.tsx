import { Formik, Field, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { DateInput } from '@/components/ui/DateInput';
import { Button } from '@/components/ui/Button';
import type { Cinema } from '@/types/entities';
import type { GiftCardFormValues } from '../../types/owner.types';
import { emptyGiftCardForm } from '../constants';

interface GiftCardFormModalProps {
  cinemas: Cinema[];
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (values: GiftCardFormValues, helpers: FormikHelpers<GiftCardFormValues>) => Promise<void>;
}

export function GiftCardFormModal({ cinemas, isSubmitting, onClose, onSubmit }: GiftCardFormModalProps) {
  const { t } = useTranslation('owner');

  const validate = (values: GiftCardFormValues) => {
    const errors: Partial<Record<keyof GiftCardFormValues, string>> = {};
    if (!values.cinema_id) errors.cinema_id = t('giftCards.validation.cinemaRequired');
    if (!values.code) errors.code = t('giftCards.validation.codeRequired');
    if (values.initial_balance === '' || Number(values.initial_balance) <= 0) {
      errors.initial_balance = t('giftCards.validation.initialBalanceInvalid');
    }
    return errors;
  };

  return (
    <Modal open onClose={onClose} title={t('giftCards.addTitle')}>
      <Formik<GiftCardFormValues> initialValues={emptyGiftCardForm()} validate={validate} onSubmit={onSubmit}>
        {(formik) => {
          const showErrors = formik.submitCount > 0;
          return (
            <Form>
              <Field
                as={Select}
                label={t('giftCards.cinemaLabel')}
                name="cinema_id"
                options={cinemas.map((c) => ({ label: c.name, value: c.id }))}
                placeholder={t('giftCards.cinemaPlaceholder')}
                error={showErrors ? formik.errors.cinema_id : undefined}
              />
              <Field
                as={Input}
                label={t('giftCards.codeLabel')}
                name="code"
                className="mt-3"
                error={showErrors ? formik.errors.code : undefined}
              />
              <Field
                as={Input}
                label={t('giftCards.initialBalanceLabel')}
                name="initial_balance"
                type="number"
                className="mt-3"
                error={showErrors ? formik.errors.initial_balance : undefined}
              />
              <Field
                as={DateInput}
                label={t('giftCards.expiresAtLabel')}
                id="expires_at"
                name="expires_at"
                className="mt-3"
              />
              <div className="mt-6 flex justify-end">
                <Button type="submit" variant="danger" loading={isSubmitting}>
                  {t('giftCards.submit')}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
}
