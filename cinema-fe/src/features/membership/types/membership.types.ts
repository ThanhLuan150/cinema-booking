export interface MembershipLevel {
  id: number;
  code: string;
  name: string;
  min_points: number;
  active: boolean;
}

export interface MembershipSummary {
  membership_level: string;
  membership_level_name: string;
  points_balance: number;
  lifetime_points: number;
  next_level: { code: string; name: string; min_points: number } | null;
  points_to_next_level: number;
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
