import { Formik, Form, type FormikHelpers } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { PromotionFormValues } from '../../types/owner.types';
import { emptyPromotionForm } from '../constants';
import { PromotionFormFields } from './PromotionFormFields';

interface AddPromotionModalProps {
  onClose: () => void;
  onSubmit: (values: PromotionFormValues, helpers: FormikHelpers<PromotionFormValues>) => Promise<void>;
  validate: (values: PromotionFormValues) => Partial<Record<keyof PromotionFormValues, string>>;
  defaultBranchId: string;
  branchOptions: { label: string; value: string }[];
  movieOptions: { label: string; value: string }[];
  comboOptions: { label: string; value: string }[];
  isPending: boolean;
}

export function AddPromotionModal({
  onClose,
  onSubmit,
  validate,
  defaultBranchId,
  branchOptions,
  movieOptions,
  comboOptions,
  isPending,
}: AddPromotionModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('promotions.addTitle')}>
      <Formik<PromotionFormValues> initialValues={emptyPromotionForm(defaultBranchId)} validate={validate} onSubmit={onSubmit}>
        {(formik) => (
          <Form>
            <PromotionFormFields formik={formik} branchOptions={branchOptions} movieOptions={movieOptions} comboOptions={comboOptions} />
            <div className="mt-6 flex justify-end">
              <Button type="submit" variant="danger" loading={isPending}>
                {t('promotions.submit')}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
