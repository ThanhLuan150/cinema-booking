export type ComboOrderStatus = 'PENDING' | 'PAID' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';

export interface ComboOrderItem {
  combo_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface ComboOrder {
  id: number;
  code: string;
  branch_id: number;
  account_id: number | null;
  booking_id: number | null;
  items: ComboOrderItem[];
  total_price: number;
  status: ComboOrderStatus;
  payment_method: 'CASH' | 'MOMO' | null;
  paid_at: string | null;
  prepared_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_by: number | null;
  createdAt: string;
}

export interface ComboOrderListParams {
  page?: number;
  limit?: number;
  status?: ComboOrderStatus;
  branchId?: number | string;
}

export interface CreateComboOrderItemInput {
  combo_id: number;
  quantity: number;
}

export interface CreateComboOrderPayload {
  branch_id: number;
  account_id?: number;
  booking_id?: number;
  items: CreateComboOrderItemInput[];
}
