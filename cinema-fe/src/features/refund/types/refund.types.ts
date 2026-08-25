export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Refund {
  id: number;
  booking_id: number;
  payment_id: number;
  account_id: number;
  branch_id: number | null;
  amount: number;
  policy_percent: number;
  reason: string | null;
  status: RefundStatus;
  requested_by: number | null;
  requested_at: string | null;
  decided_by: number | null;
  decided_at: string | null;
  decision_reason: string | null;
  processed_by: number | null;
  processed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  createdAt: string;
}

export interface RefundListParams {
  page?: number;
  limit?: number;
  status?: RefundStatus;
}
