import { Field } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { DateInput } from '@/components/ui/DateInput';
import { TimeInput } from '@/components/ui/TimeInput';
import { Select } from '@/components/ui/Select';
import type { PricingRuleFormValues } from '../../types/owner.types';
import type { SelectOption } from '../types/pricingRules.types';

interface PricingRuleFormFieldsProps {
  formik: { submitCount: number; errors: Partial<Record<keyof PricingRuleFormValues, string>> };
  branchOptions: SelectOption[];
  roomTypeOptions: SelectOption[];
  seatTypeOptions: SelectOption[];
  categoryOptions: SelectOption[];
  dayTypeOptions: SelectOption[];
  membershipOptions: SelectOption[];
}

export function PricingRuleFormFields({
  formik,
  branchOptions,
  roomTypeOptions,
  seatTypeOptions,
  categoryOptions,
  dayTypeOptions,
  membershipOptions,
}: PricingRuleFormFieldsProps) {
  const { t } = useTranslation('owner');
  const showErrors = formik.submitCount > 0;

  return (
    <>
      <Field as={Input} label={t('pricingRules.nameLabel')} name="name" error={showErrors ? formik.errors.name : undefined} />
      <Field
        as={Input}
        label={t('pricingRules.priceLabel')}
        name="price"
        type="number"
        className="mt-3"
        error={showErrors ? formik.errors.price : undefined}
      />
      <Field
        as={Input}
        label={t('pricingRules.priorityLabel')}
        name="priority"
        type="number"
        className="mt-3"
      />
      <p className="mt-1 text-xs text-txt/50">{t('pricingRules.priorityHint')}</p>
      <Field
        as={Select}
        label={t('pricingRules.branchLabel')}
        name="branch_id"
        className="mt-3"
        options={branchOptions}
        placeholder={t('pricingRules.branchPlaceholder')}
        error={showErrors ? formik.errors.branch_id : undefined}
      />
      <Field as={Select} label={t('pricingRules.roomTypeLabel')} name="room_type" className="mt-3" options={roomTypeOptions} />
      <Field as={Select} label={t('pricingRules.seatTypeLabel')} name="seat_type" className="mt-3" options={seatTypeOptions} />
      <Field as={Select} label={t('pricingRules.categoryLabel')} name="category_id" className="mt-3" options={categoryOptions} />
      <Field as={Select} label={t('pricingRules.dayTypeLabel')} name="day_type" className="mt-3" options={dayTypeOptions} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field
          as={TimeInput}
          label={t('pricingRules.timeStartLabel')}
          id="time_start"
          name="time_start"
          error={showErrors ? formik.errors.time_start : undefined}
        />
        <Field
          as={TimeInput}
          label={t('pricingRules.timeEndLabel')}
          id="time_end"
          name="time_end"
          error={showErrors ? formik.errors.time_end : undefined}
        />
      </div>
      <Field
        as={Select}
        label={t('pricingRules.membershipLabel')}
        name="membership_level"
        className="mt-3"
        options={membershipOptions}
      />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field
          as={DateInput}
          label={t('pricingRules.effectiveFromLabel')}
          id="effective_from"
          name="effective_from"
        />
        <Field
          as={DateInput}
          label={t('pricingRules.effectiveToLabel')}
          id="effective_to"
          name="effective_to"
          error={showErrors ? formik.errors.effective_to : undefined}
        />
      </div>
    </>
  );
}
