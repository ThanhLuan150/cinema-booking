export interface MembershipBenefits {
  ticket_discount_percent: number;
  fnb_discount_percent: number;
  free_tickets: number;
  free_ticket_max_value: number | null;
  priority_booking_hours: number;
  points_multiplier: number;
}

export interface MembershipLevel {
  id: number;
  code: string;
  name: string;
  min_points: number;
  active: boolean;
  benefits?: Partial<MembershipBenefits>;
}

export interface MembershipSummary {
  membership_level: string;
  membership_level_name: string;
  points_balance: number;
  lifetime_points: number;
  next_level: { code: string; name: string; min_points: number } | null;
  points_to_next_level: number;
  benefits?: MembershipBenefits;
}

export type SubscriptionStatus = 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface SubscriptionPlan {
  id: number;
  code: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  benefits: MembershipBenefits;
  active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: number;
  code: string;
  account_id: number;
  plan_id: number;
  plan: { code: string; name: string; price: number; duration_days: number; benefits: MembershipBenefits };
  price: number;
  status: SubscriptionStatus;
  start_at: string | null;
  end_at: string | null;
  tickets_used: number;
  tickets_remaining: number;
  payment_expires_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  createdAt: string;
  pay_url?: string | null;
}

export interface EffectiveBenefits {
  ticket_discount_percent: number;
  fnb_discount_percent: number;
  priority_booking_hours: number;
  points_multiplier: number;
}

export interface MembershipTierView {
  code: string;
  name: string;
  min_points: number;
  benefits: MembershipBenefits;
}

// GET /membership/me — the caller's own membership.
export interface MyMembership {
  level: MembershipTierView;
  next_level: MembershipTierView | null;
  points_balance: number;
  lifetime_points: number;
  points_to_next_level: number;
  subscription: Subscription | null;
  pending_subscription: Subscription | null;
  effective_benefits: EffectiveBenefits;
  free_tickets: {
    tier: { period: string; limit: number; used: number; remaining: number } | null;
    subscription: { limit: number; used: number; remaining: number; ends_at: string } | null;
    remaining_total: number;
  };
}

export interface SaleAccess {
  open: boolean;
  priority: boolean;
  opens_at: string | null;
  general_opens_at: string | null;
  priority_booking_hours?: number;
}

export interface MembershipPreviewPayload {
  ticketIds: number[];
  comboIds: number[];
  freeTickets: number;
}

// POST /membership/me/preview — the server's price of the order with the membership applied.
export interface MembershipPreview {
  seat_total: number;
  combo_total: number;
  order_value: number;
  membership: {
    level: string;
    subscription_id: number | null;
    free_tickets: { requested: number; applied: number; available: number };
    covered_ticket_ids: number[];
    free_ticket_amount: number;
    ticket_discount_percent: number;
    ticket_discount_amount: number;
    fnb_discount_percent: number;
    fnb_discount_amount: number;
    total: number;
  };
  value_after_membership: number;
  code_discount: number;
  total_price: number;
  sale: SaleAccess;
}

export interface PurchaseSubscriptionResult {
  subscription: Subscription;
  pay_url: string | null;
  replayed: boolean;
}

export interface SubscriptionConfirmResult {
  subscription: Subscription;
  alreadyProcessed: boolean;
  refundPending: boolean;
}

export interface SubscriptionPlanInput {
  code?: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  active: boolean;
  sort_order: number;
  benefits: MembershipBenefits;
}

export interface SubscriptionListParams {
  page?: number;
  limit?: number;
  status?: SubscriptionStatus | '';
  accountId?: number | string;
}

export type PointsTransactionType = 'EARN' | 'REDEEM' | 'EXPIRE' | 'REVERSAL' | 'ADJUST';

export interface PointsTransaction {
  id: number;
  account_id: number;
  type: PointsTransactionType;
  points: number;
  remaining_points: number;
  balance_after: number | null;
  booking_id: number | null;
  payment_id: number | null;
  expires_at: string | null;
  description: string;
  createdAt: string;
}

export interface PointsTransactionListParams {
  page?: number;
  limit?: number;
}

export interface LoyaltyConfig {
  id: number;
  amount_per_point: number;
  points_expiry_days: number | null;
  redeem_value_per_point: number;
  min_redeem_points: number;
  updated_by: number | null;
}

export interface RedeemPointsResult {
  transaction: PointsTransaction;
  redeemValue: number;
}
