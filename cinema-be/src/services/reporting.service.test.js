const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const reportingService = require('./reporting.service');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const req = (permissionScope, accountId = 1) => ({ permissionScope, account: { accountId } });

describe('reporting.service.resolveReportScope', () => {
  it('ALL scope with no branchId => every branch (null)', async () => {
    const { branchIds } = await reportingService.resolveReportScope(req('ALL'), {});
    expect(branchIds).toBeNull();
  });

  it('ALL scope with a real branchId => that single branch', async () => {
    await Branch.create({ id: 5, company_id: 1, owner_id: 9, name: 'X', code: 'X' });
    const { branchIds } = await reportingService.resolveReportScope(req('ALL'), { branchIdParam: '5' });
    expect(branchIds).toEqual([5]);
  });

  it('ALL scope with an unknown branchId is rejected', async () => {
    await expect(reportingService.resolveReportScope(req('ALL'), { branchIdParam: '999' })).rejects.toBeInstanceOf(
      reportingService.ReportAccessError,
    );
  });

  it('rejects a non-numeric branchId', async () => {
    await expect(reportingService.resolveReportScope(req('ALL'), { branchIdParam: 'abc' })).rejects.toBeInstanceOf(
      reportingService.ReportAccessError,
    );
  });

  it('BRANCH scope is forced to the branches the caller owns', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
      { id: 2, company_id: 1, owner_id: 42, name: 'B', code: 'B' },
      { id: 3, company_id: 1, owner_id: 99, name: 'C', code: 'C' },
    ]);
    const { branchIds } = await reportingService.resolveReportScope(req('BRANCH', 42), {});
    expect([...branchIds].sort()).toEqual([1, 2]);
  });

  it('BRANCH scope resolves an employee to their single staffed branch', async () => {
    await Employee.create({ id: 1, user_id: 7, branch_id: 8, employee_code: 'E1', position_id: 1, status: 1 });
    const { branchIds } = await reportingService.resolveReportScope(req('BRANCH', 7), {});
    expect(branchIds).toEqual([8]);
  });

  it('BRANCH scope requesting a branch it cannot reach is rejected', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' });
    await expect(
      reportingService.resolveReportScope(req('BRANCH', 42), { branchIdParam: '999' }),
    ).rejects.toBeInstanceOf(reportingService.ReportAccessError);
  });

  it('BRANCH scope with no accessible branch is rejected', async () => {
    await expect(reportingService.resolveReportScope(req('BRANCH', 1234), {})).rejects.toBeInstanceOf(
      reportingService.ReportAccessError,
    );
  });

  it('OWN / unknown scope is always rejected', async () => {
    await expect(reportingService.resolveReportScope(req('OWN'), {})).rejects.toBeInstanceOf(
      reportingService.ReportAccessError,
    );
    await expect(reportingService.resolveReportScope(req(undefined), {})).rejects.toBeInstanceOf(
      reportingService.ReportAccessError,
    );
  });
});

describe('reporting.service.getFinancialReport', () => {
  it('assembles the full report envelope and echoes the scope', async () => {
    const report = await reportingService.getFinancialReport({ branchIds: null });
    expect(report).toMatchObject({ scope: 'ALL', branchIds: null });
    expect(report).toHaveProperty('totals');
    expect(report).toHaveProperty('revenue.netRevenue');
    expect(report).toHaveProperty('revenueByBranch');
    expect(report).toHaveProperty('topMovies');
    expect(report).toHaveProperty('refundSummary');
    expect(report).toHaveProperty('revenueByDay');
  });

  it('marks a branch-scoped report', async () => {
    const report = await reportingService.getFinancialReport({ branchIds: [3] });
    expect(report).toMatchObject({ scope: 'BRANCH', branchIds: [3] });
    expect(report.totals.movieCount).toBeNull();
  });
});

describe('reporting.service.selectOperationalMetrics', () => {
  it('gives a Ticket Checker check-in numbers but not the combo queue', () => {
    const keys = reportingService.selectOperationalMetrics(['ticket.read', 'ticket.checkin', 'maintenance.read']);
    expect(keys).toEqual(['ticketsIssuedToday', 'ticketsCheckedInToday', 'openMaintenance']);
    expect(keys).not.toContain('pendingComboOrders');
  });

  it('gives Combo Staff the combo queue but no ticket numbers', () => {
    const keys = reportingService.selectOperationalMetrics(['combo.order.view', 'combo.sell', 'maintenance.read']);
    expect(keys).toEqual(['pendingComboOrders', 'openMaintenance']);
    expect(keys).not.toContain('ticketsCheckedInToday');
  });

  it('gives Ticket Staff showtimes and issued tickets but not check-ins', () => {
    const keys = reportingService.selectOperationalMetrics(['schedule.read', 'ticket.read', 'maintenance.read']);
    expect(keys).toEqual(['showtimesToday', 'ticketsIssuedToday', 'openMaintenance']);
  });

  it('gives a position with no operational grants only what every employee holds', () => {
    expect(reportingService.selectOperationalMetrics(['maintenance.read'])).toEqual(['openMaintenance']);
  });

  it('returns nothing for an empty or missing permission set', () => {
    expect(reportingService.selectOperationalMetrics([])).toEqual([]);
    expect(reportingService.selectOperationalMetrics(undefined)).toEqual([]);
  });

  it('gives a manager holding every permission the full strip', () => {
    const all = Object.values(reportingService.OPERATIONAL_METRICS);
    expect(reportingService.selectOperationalMetrics(all)).toEqual(Object.keys(reportingService.OPERATIONAL_METRICS));
  });
});

describe('reporting.service.getOperationalReport', () => {
  it('narrows the metrics to what the caller\'s Position grants', async () => {
    await seedRbac();
    await seedPositions();
    const checker = await Position.findOne({ code: 'TICKET_CHECKER' });
    await Employee.create({ id: 1, user_id: 55, branch_id: 1, employee_code: 'E1', position_id: checker.id, status: 1 });

    const report = await reportingService.getOperationalReport({
      branchIds: [1],
      account: { accountId: 55, role: 3 },
    });
    expect(report).toMatchObject({ scope: 'BRANCH', branchIds: [1], positionCode: 'TICKET_CHECKER' });
    expect(Object.keys(report.metrics).sort()).toEqual(
      ['openMaintenance', 'ticketsCheckedInToday', 'ticketsIssuedToday'].sort(),
    );
    expect(report.metrics).not.toHaveProperty('pendingComboOrders');
  });

  it('gives a Branch Admin every metric their existing permissions cover, and no positionCode', async () => {
    await seedRbac();
    const report = await reportingService.getOperationalReport({
      branchIds: [1],
      account: { accountId: 42, role: 2 },
    });
    expect(report.positionCode).toBeNull();
    expect(Object.keys(report.metrics).sort()).toEqual(
      ['openMaintenance', 'showtimesToday', 'ticketsCheckedInToday', 'ticketsIssuedToday'].sort(),
    );
  });

  it('gives a Super Admin the complete strip', async () => {
    await seedRbac();
    const report = await reportingService.getOperationalReport({
      branchIds: null,
      account: { accountId: 1, role: 0 },
    });
    expect(Object.keys(report.metrics).sort()).toEqual(Object.keys(reportingService.OPERATIONAL_METRICS).sort());
  });
});
