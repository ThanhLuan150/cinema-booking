export type CashierShiftStatus = 'OPEN' | 'CLOSED';

export interface CashierShift {
  id: number;
  employee_id: number;
  account_id: number;
  branch_id: number;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  cash_sales: number | null;
  cash_refunds: number | null;
  expected_cash: number | null;
  actual_cash: number | null;
  difference: number | null;
  status: CashierShiftStatus;
  opened_by: number | null;
  closed_by: number | null;
  open_note: string | null;
  close_note: string | null;
  createdAt: string;
}

export interface CashierShiftReconciliation {
  openingCash: number;
  cashSales: number;
  ticketCash?: number;
  comboCash?: number;
  cashRefunds: number;
  expectedCash: number;
  actualCash: number | null;
  difference: number | null;
  live: boolean;
}

export interface CashierShiftListParams {
  page?: number;
  limit?: number;
  status?: CashierShiftStatus;
  branchId?: number | string;
  employeeId?: number | string;
}

export interface OpenCashierShiftPayload {
  branch_id: number;
  opening_cash: number;
  note?: string;
}

export interface CloseCashierShiftPayload {
  actual_cash: number;
  note?: string;
}

export interface CurrentCashierShiftResponse {
  shift: CashierShift | null;
  reconciliation: CashierShiftReconciliation | null;
}

export interface CashierShiftDetailResponse {
  shift: CashierShift;
  reconciliation: CashierShiftReconciliation;
}
