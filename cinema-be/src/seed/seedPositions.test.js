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
  it('creates the 10 required positions', async () => {
    await seedRbac();
    await seedPositions();
    const positions = await Position.find().sort({ code: 1 });
    expect(positions.map((p) => p.code).sort()).toEqual(
      [
        'CASHIER',
        'CHECK_IN_STAFF',
        'CLEANING_STAFF',
        'CONCESSION_STAFF',
        'CUSTOMER_SERVICE',
        'FNB_STAFF',
        'MAINTENANCE_STAFF',
        'SECURITY',
        'TICKET_STAFF',
        'USHER',
      ].sort(),
    );
  });

  it('is idempotent when run twice', async () => {
    await seedRbac();
    await seedPositions();
    await seedPositions();
    expect(await Position.countDocuments()).toBe(10);
  });

  it('grants Cashier booking/ticket/combo read, combo.sell and payment.create at BRANCH scope', async () => {
    await seedRbac();
    await seedPositions();
    for (const code of ['booking.read', 'booking.create', 'ticket.read', 'combo.view', 'combo.sell', 'payment.create']) {
      expect(await scopeFor('CASHIER', code)).toBe('BRANCH');
    }
  });

  it('gives Cleaning Staff zero position-level permissions', async () => {
    await seedRbac();
    await seedPositions();
    for (const code of ['CLEANING_STAFF']) {
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

  it('grants Check-in Staff only ticket.read and ticket.checkin', async () => {
    await seedRbac();
    await seedPositions();
    const position = await Position.findOne({ code: 'CHECK_IN_STAFF' });
    const links = await PositionPermission.find({ position_id: position.id });
    const permissions = await Permission.find({ id: { $in: links.map((l) => l.permission_id) } });
    expect(permissions.map((p) => p.code).sort()).toEqual(['ticket.checkin', 'ticket.read']);
  });

  async function grantCodes(positionCode) {
    const position = await Position.findOne({ code: positionCode });
    const links = await PositionPermission.find({ position_id: position.id });
    const permissions = await Permission.find({ id: { $in: links.map((l) => l.permission_id) } });
    return permissions.map((p) => p.code).sort();
  }

  it('grants the Ticket 42 example permission sets (repo naming: .read rather than .view)', async () => {
    await seedRbac();
    await seedPositions();
    expect(await grantCodes('CONCESSION_STAFF')).toEqual(expect.arrayContaining(['combo.view', 'combo.sell', 'inventory.view']));
    expect(await grantCodes('USHER')).toEqual(['room.read', 'seat.read', 'ticket.checkin', 'ticket.read']);
    expect(await grantCodes('SECURITY')).toEqual(['incident.create', 'incident.read', 'room.read']);
    expect(await grantCodes('FNB_STAFF')).toEqual(['combo.order.update', 'combo.order.view', 'combo.view', 'inventory.view']);
    expect(await grantCodes('CASHIER')).toEqual(
      expect.arrayContaining(['booking.read', 'booking.create', 'payment.create', 'ticket.create']),
    );
  });

  it('never gives a floor Position an account/employee/position/branch administration permission', async () => {
    await seedRbac();
    await seedPositions();
    // Customer Service legitimately holds user.read (customer lookup); nothing that writes users,
    // employees or positions, or touches branch/system administration, may ever be a Position grant.
    const forbidden = /^(employee\..+|user\.(update|block|approve|delete)|position\..+|branch\..+|branchAdmin\..+|systemConfig\.manage|integration\..+)$/;
    for (const { code } of await Position.find()) {
      expect((await grantCodes(code)).filter((c) => forbidden.test(c))).toEqual([]);
    }
  });

  it('never grants a Position a permission that does not exist in the registry', async () => {
    await seedRbac();
    await seedPositions(); // throws on an unknown code, so reaching here proves every grant resolves
    expect(await PositionPermission.countDocuments()).toBeGreaterThan(0);
  });

  describe('legacy code migration', () => {
    const Employee = require('../models/Employee');

    async function seedLegacyDatabase() {
      await seedRbac();
      await seedPositions();
      // Rewind two positions to the pre-Ticket-42 codes, as an existing database would have them.
      await Position.updateOne({ code: 'CONCESSION_STAFF' }, { $set: { code: 'COMBO_STAFF', name: 'Combo Staff' } });
      await Position.updateOne({ code: 'CHECK_IN_STAFF' }, { $set: { code: 'TICKET_CHECKER', name: 'Ticket Checker' } });
    }

    it('renames legacy codes in place, keeping the id so employees and grants stay attached', async () => {
      await seedLegacyDatabase();
      const legacy = await Position.findOne({ code: 'COMBO_STAFF' });
      await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'E1', position_id: legacy.id });
      const grantsBefore = await PositionPermission.countDocuments({ position_id: legacy.id });

      const summary = await seedPositions.renameLegacyPositions();

      expect(summary).toEqual(
        expect.arrayContaining([
          { from: 'COMBO_STAFF', to: 'CONCESSION_STAFF', merged: false },
          { from: 'TICKET_CHECKER', to: 'CHECK_IN_STAFF', merged: false },
        ]),
      );
      const renamed = await Position.findOne({ code: 'CONCESSION_STAFF' });
      expect(renamed.id).toBe(legacy.id);
      expect(renamed.name).toBe('Concession Staff');
      expect(await Position.findOne({ code: 'COMBO_STAFF' })).toBeNull();
      expect((await Employee.findOne({ id: 1 })).position_id).toBe(renamed.id);
      expect(await PositionPermission.countDocuments({ position_id: renamed.id })).toBe(grantsBefore);
    });

    it('seedPositions performs the rename itself, so a plain re-seed does not orphan the legacy row', async () => {
      await seedLegacyDatabase();
      await seedPositions();
      expect(await Position.countDocuments()).toBe(10);
      expect(await Position.findOne({ code: 'TICKET_CHECKER' })).toBeNull();
    });

    it('is idempotent', async () => {
      await seedLegacyDatabase();
      await seedPositions.renameLegacyPositions();
      expect(await seedPositions.renameLegacyPositions()).toEqual([]);
    });

    it('merges into the new Position when both codes already exist, moving employees across', async () => {
      await seedRbac();
      await seedPositions();
      const current = await Position.findOne({ code: 'CONCESSION_STAFF' });
      const nextId = require('../utils/nextId');
      const legacy = await Position.create({ id: await nextId('position'), code: 'COMBO_STAFF', name: 'Combo Staff', status: 1 });
      await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'E1', position_id: legacy.id });

      const summary = await seedPositions.renameLegacyPositions();

      expect(summary).toEqual([{ from: 'COMBO_STAFF', to: 'CONCESSION_STAFF', merged: true }]);
      expect(await Position.findOne({ code: 'COMBO_STAFF' })).toBeNull();
      expect((await Employee.findOne({ id: 1 })).position_id).toBe(current.id);
    });
  });

  it('prunes a stale position-permission link on the next run', async () => {
    await seedRbac();
    await seedPositions();
    const position = await Position.findOne({ code: 'CHECK_IN_STAFF' });
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
