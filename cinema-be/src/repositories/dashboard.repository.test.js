const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const dashboardRepository = require('./dashboard.repository');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Invoice = require('../models/Invoice');
const Account = require('../models/Account');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('dashboard.repository', () => {
  describe('groupRevenueByDay', () => {
    it('groups and sums invoice totals by calendar day, sorted ascending', () => {
      const invoices = [
        { createdAt: new Date('2026-01-02T10:00:00Z'), total_price: 100 },
        { createdAt: new Date('2026-01-01T10:00:00Z'), total_price: 200 },
        { createdAt: new Date('2026-01-01T15:00:00Z'), total_price: 50 },
      ];
      const result = dashboardRepository.groupRevenueByDay(invoices);
      expect(result).toEqual([
        { date: '2026-01-01', total: 250 },
        { date: '2026-01-02', total: 100 },
      ]);
    });

    it('returns an empty array for no invoices', () => {
      expect(dashboardRepository.groupRevenueByDay([])).toEqual([]);
    });
  });

  describe('findOwnerScopedCinemas', () => {
    it('scopes to the owner for a non-admin role', async () => {
      await Branch.create([
        { id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'A' },
        { id: 2, company_id: 1, owner_id: 99, name: 'Not mine', code: 'B' },
      ]);
      const result = await dashboardRepository.findOwnerScopedCinemas({ role: 2, accountId: 42 });
      expect(result).toHaveLength(1);
    });

    it('returns all branches for an admin', async () => {
      await Branch.create([
        { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
        { id: 2, company_id: 1, owner_id: 99, name: 'B', code: 'B' },
      ]);
      const result = await dashboardRepository.findOwnerScopedCinemas({ role: 0, accountId: 1 });
      expect(result).toHaveLength(2);
    });
  });

  describe('getOwnerStats', () => {
    it('computes revenue, sold count, occupancy and schedule count', async () => {
      await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
      await Schedule.create({
        id: 1,
        movie_id: 1,
        room_id: 1,
        movie_date: '2026-01-01',
        time_begin: '10:00',
        time_end: '12:00',
        price: 1,
      });
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 1 },
      ]);
      await Invoice.create([
        { id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 100000, status: 1 },
        { id: 2, ticket_id: 2, account_id: 1, code: 'B', total_price: 999999, status: 0 }, // cancelled, excluded
      ]);

      const stats = await dashboardRepository.getOwnerStats([1]);
      expect(stats.revenue).toBe(100000);
      expect(stats.totalTicketsSold).toBe(1);
      expect(stats.totalSeats).toBe(2);
      expect(stats.occupancyRate).toBe(50);
      expect(stats.scheduleCount).toBe(1);
    });

    it('returns zeroed stats when there are no tickets', async () => {
      const stats = await dashboardRepository.getOwnerStats([]);
      expect(stats.occupancyRate).toBe(0);
      expect(stats.revenue).toBe(0);
    });
  });

  describe('getAdminTotals', () => {
    it('aggregates counts across users, owners, branches and tickets', async () => {
      await Account.create([
        { id: 1, email: 'u1@b.com', password: 'x', role: 1 },
        { id: 2, email: 'u2@b.com', password: 'x', role: 1 },
        { id: 3, email: 'o1@b.com', password: 'x', role: 2 },
      ]);
      await Branch.create({ id: 1, company_id: 1, owner_id: 3, name: 'A', code: 'A' });
      await Ticket.create({ id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 });
      await Invoice.create({ id: 1, ticket_id: 1, account_id: 1, code: 'A', total_price: 100, status: 1 });

      const totals = await dashboardRepository.getAdminTotals();
      expect(totals.totalUsers).toBe(2);
      expect(totals.totalOwners).toBe(1);
      expect(totals.totalCinemas).toBe(1);
      expect(totals.totalTicketsSold).toBe(1);
      expect(totals.invoices).toHaveLength(1);
    });
  });
});
