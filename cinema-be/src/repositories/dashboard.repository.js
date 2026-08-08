const Invoice = require('../models/Invoice');
const Ticket = require('../models/Ticket');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');
const Branch = require('../models/Branch');
const Account = require('../models/Account');

function groupRevenueByDay(invoices) {
  const byDay = new Map();
  for (const inv of invoices) {
    const day = inv.createdAt.toISOString().split('T')[0];
    byDay.set(day, (byDay.get(day) || 0) + inv.total_price);
  }
  return Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, total]) => ({ date, total }));
}

async function findOwnerScopedCinemas({ role, accountId }) {
  const branchFilter = role === 0 ? {} : { owner_id: accountId };
  return Branch.find(branchFilter).sort({ id: 1 });
}

async function getOwnerStats(branchIds) {
  const rooms = await Room.find({ cinema_id: { $in: branchIds } });
  const roomIds = rooms.map((r) => r.id);
  const schedules = await Schedule.find({ room_id: { $in: roomIds } });
  const scheduleIds = schedules.map((s) => s.id);

  const tickets = await Ticket.find({ schedule_id: { $in: scheduleIds } });
  const ticketIds = tickets.map((t) => t.id);
  const soldCount = tickets.filter((t) => t.status === 0).length;

  const invoices = await Invoice.find({ ticket_id: { $in: ticketIds }, status: { $ne: 0 } });
  const revenue = invoices.reduce((sum, inv) => sum + inv.total_price, 0);
  const occupancyRate = tickets.length > 0 ? Math.round((soldCount / tickets.length) * 1000) / 10 : 0;

  return {
    revenue,
    totalTicketsSold: soldCount,
    totalSeats: tickets.length,
    occupancyRate,
    scheduleCount: schedules.length,
    invoices,
  };
}

async function getAdminTotals() {
  const [totalUsers, totalOwners, totalCinemas, totalTicketsSold, invoices] = await Promise.all([
    Account.countDocuments({ role: 1 }),
    Account.countDocuments({ role: 2 }),
    Branch.countDocuments(),
    Ticket.countDocuments({ status: 0 }),
    Invoice.find({ status: { $ne: 0 } }),
  ]);

  return { totalUsers, totalOwners, totalCinemas, totalTicketsSold, invoices };
}

module.exports = { groupRevenueByDay, findOwnerScopedCinemas, getOwnerStats, getAdminTotals };
