const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const seedRbac = require('./seedRbac');
const seedPositions = require('./seedPositions');
const Position = require('../models/Position');
const Permission = require('../models/Permission');
const PositionPermission = require('../models/PositionPermission');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function scopeFor(positionCode, permissionCode) {
  const position = await Position.findOne({ code: positionCode });
  const permission = await Permission.findOne({ code: permissionCode });
  const link = await PositionPermission.findOne({ position_id: position.id, permission_id: permission.id });
  return link ? link.scope : null;
}

describe('seedPositions', () => {
  it('creates the 8 minimum required positions', async () => {
    await seedRbac();
    await seedPositions();
    const positions = await Position.find().sort({ code: 1 });
    expect(positions.map((p) => p.code).sort()).toEqual(
      [
        'CASHIER',
        'CLEANING_STAFF',
        'COMBO_STAFF',
        'CUSTOMER_SERVICE',
        'MAINTENANCE_STAFF',
        'SECURITY',
        'TICKET_CHECKER',
        'TICKET_STAFF',
      ].sort(),
    );
  });

  it('is idempotent when run twice', async () => {
    await seedRbac();
    await seedPositions();
    await seedPositions();
    expect(await Position.countDocuments()).toBe(8);
  });

  it('grants Cashier booking/ticket/combo read, combo.sell and payment.create at BRANCH scope', async () => {
    await seedRbac();
    await seedPositions();
    for (const code of ['booking.read', 'booking.create', 'ticket.read', 'combo.view', 'combo.sell', 'payment.create']) {
      expect(await scopeFor('CASHIER', code)).toBe('BRANCH');
    }
  });

  it('gives Security and Cleaning Staff zero permissions', async () => {
    await seedRbac();
    await seedPositions();
    for (const code of ['SECURITY', 'CLEANING_STAFF']) {
      const position = await Position.findOne({ code });
      const links = await PositionPermission.countDocuments({ position_id: position.id });
      expect(links).toBe(0);
    }
  });

  it('grants Maintenance Staff only maintenance.update, at BRANCH scope', async () => {
    await seedRbac();
    await seedPositions();
    const position = await Position.findOne({ code: 'MAINTENANCE_STAFF' });
    const links = await PositionPermission.find({ position_id: position.id });
    const permissions = await Permission.find({ id: { $in: links.map((l) => l.permission_id) } });
    expect(permissions.map((p) => p.code)).toEqual(['maintenance.update']);
    expect(await scopeFor('MAINTENANCE_STAFF', 'maintenance.update')).toBe('BRANCH');
  });

  it('never grants Security booking.create, payment.create or ticket.checkin', async () => {
    await seedRbac();
    await seedPositions();
    for (const code of ['booking.create', 'payment.create', 'ticket.checkin']) {
      expect(await scopeFor('SECURITY', code)).toBeNull();
    }
  });

  it('grants Ticket Staff booking.create and payment.create at BRANCH scope', async () => {
    await seedRbac();
    await seedPositions();
    expect(await scopeFor('TICKET_STAFF', 'booking.create')).toBe('BRANCH');
    expect(await scopeFor('TICKET_STAFF', 'payment.create')).toBe('BRANCH');
  });

  it('grants Ticket Staff and Customer Service schedule.read at BRANCH scope (the "EMPLOYEE showtime.view" role from the RBAC doc, applied per-Position)', async () => {
    await seedRbac();
    await seedPositions();
    expect(await scopeFor('TICKET_STAFF', 'schedule.read')).toBe('BRANCH');
    expect(await scopeFor('CUSTOMER_SERVICE', 'schedule.read')).toBe('BRANCH');
  });

  it('grants Ticket Checker only ticket.read and ticket.checkin', async () => {
    await seedRbac();
    await seedPositions();
    const position = await Position.findOne({ code: 'TICKET_CHECKER' });
    const links = await PositionPermission.find({ position_id: position.id });
    const permissions = await Permission.find({ id: { $in: links.map((l) => l.permission_id) } });
    expect(permissions.map((p) => p.code).sort()).toEqual(['ticket.checkin', 'ticket.read']);
  });

  it('prunes a stale position-permission link on the next run', async () => {
    await seedRbac();
    await seedPositions();
    const position = await Position.findOne({ code: 'TICKET_CHECKER' });
    const permission = await Permission.findOne({ code: 'booking.create' });
    const nextId = require('../utils/nextId');
    const id = await nextId('positionPermission');
    await PositionPermission.create({ id, position_id: position.id, permission_id: permission.id, scope: 'BRANCH' });

    await seedPositions();

    expect(await PositionPermission.findOne({ position_id: position.id, permission_id: permission.id })).toBeNull();
  });

  it('throws a clear error if seedRbac has not run yet (unknown permission code)', async () => {
    await expect(seedPositions()).rejects.toThrow(/unknown permission code/);
  });
});
