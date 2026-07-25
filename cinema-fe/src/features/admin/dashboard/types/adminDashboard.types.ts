export interface RevenueByDay {
  date: string;
  total: number;
}

export interface AdminDashboardStats {
  totalRevenue: number;
  totalUsers: number;
  totalOwners: number;
  totalCinemas: number;
  totalTicketsSold: number;
  totalTransactions: number;
  revenueByDay: RevenueByDay[];
}
