import type { TFunction } from 'i18next';
import type { ComboFormValues } from '../types/owner.types';

export const COMBO_TYPE_OPTIONS = ['FOOD', 'BEVERAGE', 'COMBO'] as const;

export const COMBO_TYPE_LABEL_KEY: Record<(typeof COMBO_TYPE_OPTIONS)[number], string> = {
  FOOD: 'combos.typeFood',
  BEVERAGE: 'combos.typeBeverage',
  COMBO: 'combos.typeCombo',
};

export const emptyComboForm = (): ComboFormValues => ({
  cinema_id: '',
  name: '',
  description: '',
  price: '',
  type: 'COMBO',
  items: {},
});

export const validateComboForm = (values: ComboFormValues, t: TFunction) => {
  const errors: Partial<Record<keyof ComboFormValues, string>> = {};
  if (!values.cinema_id) errors.cinema_id = t('combos.validation.cinemaRequired');
  if (!values.name) errors.name = t('combos.validation.nameRequired');
  if (!values.description.trim()) errors.description = t('combos.validation.descriptionRequired');
  if (values.price === '') {
    errors.price = t('combos.validation.priceRequired');
  } else if (Number(values.price) <= 0) {
    errors.price = t('combos.validation.priceInvalid');
  }
  return errors;
};
