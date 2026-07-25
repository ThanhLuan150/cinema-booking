export interface AdminInvoice {
  id: number;
  code: string;
  status: number;
  total_price: number;
  account?: { email: string };
  movie?: { name: string };
  ticket?: { seat_code: string };
}
