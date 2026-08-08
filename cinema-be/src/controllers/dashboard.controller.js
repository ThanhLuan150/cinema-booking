const dashboardRepository = require('../repositories/dashboard.repository');

// GET /api/owner/dashboard?branchId= -> revenue/tickets/occupancy scoped to the caller's cinema(s)
async function ownerDashboard(req, res) {
  const cinemas = await dashboardRepository.findOwnerScopedCinemas({
    role: req.account.role,
    accountId: req.account.accountId,
  });

  let scopedbranchIds = cinemas.map((c) => c.id);
  if (req.query.branchId) {
    const requestedId = Number(req.query.branchId);
    if (!scopedbranchIds.includes(requestedId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    scopedbranchIds = [requestedId];
  }

  const stats = await dashboardRepository.getOwnerStats(scopedbranchIds);

  res.json({
    cinemas: cinemas.map((c) => ({ id: c.id, name: c.name, status: c.status })),
    revenue: stats.revenue,
    totalTicketsSold: stats.totalTicketsSold,
    totalSeats: stats.totalSeats,
    occupancyRate: stats.occupancyRate,
    scheduleCount: stats.scheduleCount,
    transactionCount: stats.invoices.length,
    revenueByDay: dashboardRepository.groupRevenueByDay(stats.invoices),
  });
}

// GET /api/admin/dashboard -> system-wide totals (admin only)
async function adminDashboard(req, res) {
  const totals = await dashboardRepository.getAdminTotals();
  const totalRevenue = totals.invoices.reduce((sum, inv) => sum + inv.total_price, 0);

  res.json({
    totalRevenue,
    totalUsers: totals.totalUsers,
    totalOwners: totals.totalOwners,
    totalCinemas: totals.totalCinemas,
    totalTicketsSold: totals.totalTicketsSold,
    totalTransactions: totals.invoices.length,
    revenueByDay: dashboardRepository.groupRevenueByDay(totals.invoices),
  });
}

module.exports = { ownerDashboard, adminDashboard };
