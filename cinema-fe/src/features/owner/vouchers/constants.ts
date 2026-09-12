import { DISCOUNT_TYPE } from '@/constants/discountType';
import type { VoucherFormValues } from '../types/owner.types';

export const FREE_TYPES: string[] = [DISCOUNT_TYPE.FREE_TICKET, DISCOUNT_TYPE.FREE_COMBO];

export const emptyVoucherForm = (): VoucherFormValues => ({
  cinema_id: '',
  code: '',
  discount_type: DISCOUNT_TYPE.PERCENTAGE,
  discount_value: '',
  free_quantity: '',
  combo_id: '',
  min_order_value: '',
});
