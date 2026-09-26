import type { TFunction } from 'i18next';
import type { InventoryDetailValues } from '../types/owner.types';

// Mirrors the backend's SKU rule (controllers/inventory.controller.js) so the form rejects what
// the API would.
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;

const isNonNegative = (value: string) => value === '' || (Number.isFinite(Number(value)) && Number(value) >= 0);

export type InventoryDetailErrors = Partial<Record<keyof InventoryDetailValues, string>>;

export function validateInventoryDetails(values: InventoryDetailValues, t: TFunction): InventoryDetailErrors {
  const errors: InventoryDetailErrors = {};
  if (!values.item.trim()) errors.item = t('inventory.validation.itemRequired');
  if (!values.unit.trim()) errors.unit = t('inventory.validation.unitRequired');
  if (values.sku.trim() && !SKU_PATTERN.test(values.sku.trim())) errors.sku = t('inventory.validation.skuInvalid');
  if (values.category.trim().length > 60) errors.category = t('inventory.validation.categoryTooLong');
  if (!isNonNegative(values.minimum_quantity)) errors.minimum_quantity = t('inventory.validation.minQuantityInvalid');
  if (!isNonNegative(values.cost_price)) errors.cost_price = t('inventory.validation.priceInvalid');
  if (!isNonNegative(values.selling_price)) errors.selling_price = t('inventory.validation.priceInvalid');
  return errors;
}
