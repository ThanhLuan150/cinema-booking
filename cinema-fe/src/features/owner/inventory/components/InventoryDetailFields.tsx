import { Field, useFormikContext } from 'formik';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import type { InventoryDetailValues } from '../../types/owner.types';
import { ComboLinkField } from './ComboLinkField';

interface InventoryDetailFieldsProps {
  cinemaId: string;
}

// The catalogue half of the product form, shared by "add" and "edit": name, SKU, category, unit,
// prices, minimum stock and the optional combo link. Reads/writes the surrounding Formik form.
export function InventoryDetailFields({ cinemaId }: InventoryDetailFieldsProps) {
  const { t } = useTranslation('owner');
  const { values, errors, submitCount, setFieldValue } = useFormikContext<InventoryDetailValues>();
  const showErrors = submitCount > 0;
  const error = (name: keyof InventoryDetailValues) => (showErrors ? errors[name] : undefined);

  return (
    <>
      <Field as={Input} label={t('inventory.itemLabel')} name="item" className="mt-3" error={error('item')} />
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field as={Input} label={t('inventory.skuLabel')} name="sku" error={error('sku')} />
        <Field as={Input} label={t('inventory.categoryLabel')} name="category" error={error('category')} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field as={Input} label={t('inventory.unitLabel')} name="unit" error={error('unit')} />
        <Field
          as={Input}
          label={t('inventory.minQuantityLabel')}
          name="minimum_quantity"
          type="number"
          error={error('minimum_quantity')}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field
          as={Input}
          label={t('inventory.costPriceLabel')}
          name="cost_price"
          type="number"
          error={error('cost_price')}
        />
        <Field
          as={Input}
          label={t('inventory.sellingPriceLabel')}
          name="selling_price"
          type="number"
          error={error('selling_price')}
        />
      </div>
      <ComboLinkField
        cinemaId={cinemaId}
        value={values.combo_id}
        onChange={(value) => setFieldValue('combo_id', value)}
      />
    </>
  );
}
