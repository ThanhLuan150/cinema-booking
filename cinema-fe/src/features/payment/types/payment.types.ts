export type PaymentLifecycleStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';
export type PaymentType = 'ONLINE' | 'COUNTER';
export type PaymentMethod = 'MOMO' | 'CASH';

export interface Payment {
  id: number;
  code: string;
  booking_id: number;
  account_id: number;
  branch_id: number | null;
  type: PaymentType;
  method: PaymentMethod;
  amount: number;
  status: PaymentLifecycleStatus;
  failure_reason: string | null;
  paid_at: string | null;
  failed_at: string | null;
  refund_reason: string | null;
  refund_requested_at: string | null;
  refunded_at: string | null;
  createdAt: string;
}

export interface PaymentListParams {
  page?: number;
  limit?: number;
  status?: PaymentLifecycleStatus;
  type?: PaymentType;
}
