import { PROMOTION_DISCOUNT_TYPE } from '@/constants/promotionDiscountType';
import type { PromotionFormValues } from '../types/owner.types';

// branch_id: '' is only ever reached transiently for a non-admin before their first owned
// branch loads in; ALL_BRANCHES is the explicit "system-wide" choice, admin-only (mirrors
// PricingRuleFormValues.branch_id). movie_id/combo_id: '' = no restriction on that dimension.
// Showtime-level targeting has no picker in this UI yet — the backend still enforces it fully
// (see promotion.controller.js / promotionPricing.js) for promotions created via the API.
export const ALL_BRANCHES = 'ALL';

export function emptyPromotionForm(branchId: string): PromotionFormValues {
  return {
    code: '',
    name: '',
    description: '',
    discount_type: PROMOTION_DISCOUNT_TYPE.PERCENTAGE,
    discount_value: '',
    minimum_order_value: '',
    maximum_discount: '',
    start_at: '',
    end_at: '',
    usage_limit: '',
    per_customer_limit: '',
    branch_id: branchId,
    movie_id: '',
    combo_id: '',
  };
}
