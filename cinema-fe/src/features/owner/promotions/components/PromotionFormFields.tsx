import { Field } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DateInput } from '@/components/ui/DateInput';
import { Select } from '@/components/ui/Select';
import { PROMOTION_DISCOUNT_TYPE } from '@/constants/promotionDiscountType';
import type { PromotionFormValues } from '../../types/owner.types';

interface PromotionFormFieldsProps {
  formik: { submitCount: number; errors: Partial<Record<keyof PromotionFormValues, string>> };
  branchOptions: { label: string; value: string }[];
  movieOptions: { label: string; value: string }[];
  comboOptions: { label: string; value: string }[];
}

export function PromotionFormFields({ formik, branchOptions, movieOptions, comboOptions }: PromotionFormFieldsProps) {
  const { t } = useTranslation('owner');
  const showErrors = formik.submitCount > 0;

  const discountTypeOptions = [
    { label: t('promotions.discountTypePercentage'), value: PROMOTION_DISCOUNT_TYPE.PERCENTAGE },
    { label: t('promotions.discountTypeFixed'), value: PROMOTION_DISCOUNT_TYPE.FIXED_AMOUNT },
  ];

  return (
    <>
      <Field as={Input} label={t('promotions.codeLabel')} name="code" error={showErrors ? formik.errors.code : undefined} />
      <Field
        as={Input}
        label={t('promotions.nameLabel')}
        name="name"
        className="mt-3"
        error={showErrors ? formik.errors.name : undefined}
      />
      <Field as={Textarea} label={t('promotions.descriptionLabel')} name="description" className="mt-3" rows={2} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field as={Select} label={t('promotions.discountTypeLabel')} name="discount_type" options={discountTypeOptions} />
        <Field
          as={Input}
          label={t('promotions.discountValueLabel')}
          name="discount_value"
          type="number"
          error={showErrors ? formik.errors.discount_value : undefined}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field as={Input} label={t('promotions.minOrderValueLabel')} name="minimum_order_value" type="number" />
        <Field as={Input} label={t('promotions.maxDiscountLabel')} name="maximum_discount" type="number" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field
          as={DateInput}
          label={t('promotions.startAtLabel')}
          id="start_at"
          name="start_at"
          error={showErrors ? formik.errors.start_at : undefined}
        />
        <Field
          as={DateInput}
          label={t('promotions.endAtLabel')}
          id="end_at"
          name="end_at"
          error={showErrors ? formik.errors.end_at : undefined}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field as={Input} label={t('promotions.usageLimitLabel')} name="usage_limit" type="number" />
        <Field as={Input} label={t('promotions.perCustomerLimitLabel')} name="per_customer_limit" type="number" />
      </div>
      <Field
        as={Select}
        label={t('promotions.branchLabel')}
        name="branch_id"
        className="mt-3"
        options={branchOptions}
        placeholder={t('promotions.branchPlaceholder')}
        error={showErrors ? formik.errors.branch_id : undefined}
      />
      <Field as={Select} label={t('promotions.movieLabel')} name="movie_id" className="mt-3" options={movieOptions} />
      <Field as={Select} label={t('promotions.comboLabel')} name="combo_id" className="mt-3" options={comboOptions} />
    </>
  );
}
