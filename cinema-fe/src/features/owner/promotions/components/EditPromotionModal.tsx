import { Formik, Form } from 'formik';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Promotion } from '@/types/entities';
import type { PromotionFormValues } from '../../types/owner.types';
import { ALL_BRANCHES } from '../constants';
import { PromotionFormFields } from './PromotionFormFields';

function promotionToFormValues(promotion: Promotion): PromotionFormValues {
  return {
    code: promotion.code,
    name: promotion.name,
    description: promotion.description,
    discount_type: promotion.discount_type,
    discount_value: String(promotion.discount_value),
    minimum_order_value: String(promotion.minimum_order_value),
    maximum_discount: promotion.maximum_discount === null ? '' : String(promotion.maximum_discount),
    start_at: promotion.start_at.slice(0, 10),
    end_at: promotion.end_at.slice(0, 10),
    usage_limit: promotion.usage_limit === null ? '' : String(promotion.usage_limit),
    per_customer_limit: promotion.per_customer_limit === null ? '' : String(promotion.per_customer_limit),
    branch_id: promotion.branch_ids.length === 0 ? ALL_BRANCHES : String(promotion.branch_ids[0]),
    movie_id: promotion.movie_ids.length > 0 ? String(promotion.movie_ids[0]) : '',
    combo_id: promotion.combo_ids.length > 0 ? String(promotion.combo_ids[0]) : '',
  };
}

interface EditPromotionModalProps {
  promotion: Promotion;
  onClose: () => void;
  onSubmit: (values: PromotionFormValues) => Promise<void>;
  validate: (values: PromotionFormValues) => Partial<Record<keyof PromotionFormValues, string>>;
  branchOptions: { label: string; value: string }[];
  movieOptions: { label: string; value: string }[];
  comboOptions: { label: string; value: string }[];
  isPending: boolean;
}

export function EditPromotionModal({
  promotion,
  onClose,
  onSubmit,
  validate,
  branchOptions,
  movieOptions,
  comboOptions,
  isPending,
}: EditPromotionModalProps) {
  const { t } = useTranslation('owner');

  return (
    <Modal open onClose={onClose} title={t('promotions.editTitle')}>
      <Formik<PromotionFormValues> initialValues={promotionToFormValues(promotion)} validate={validate} onSubmit={onSubmit}>
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
