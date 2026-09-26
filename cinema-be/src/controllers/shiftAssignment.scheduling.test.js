// Ticket 44 — Employee Shift Scheduling: time-overlap conflict validation, Position on a shift,
// reactivation re-checks, the concurrent-write guard and the Super Admin all-branches listing.
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const shiftAssignmentController = require('./shiftAssignment.controller');
const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const ShiftAssignment = require('../models/ShiftAssignment');
const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => {
  jest.restoreAllMocks();
  await clearDatabase();
});
afterAll(async () => closeDatabase());

const BRANCH = 5;

async function seed() {
  await Position.create([
    { id: 1, code: 'TICKET_STAFF', name: 'Ticket Staff', status: 1 },
    { id: 2, code: 'CASHIER', name: 'Cashier', status: 1 },
    { id: 3, code: 'RETIRED', name: 'Retired', status: 0 },
  ]);
  await Employee.create([
    { id: 1, user_id: 7, branch_id: BRANCH, employee_code: 'EMP-000001', position_id: 1, status: 1 },
    { id: 2, user_id: 8, branch_id: BRANCH, employee_code: 'EMP-000002', position_id: 1, status: 1 },
  ]);
  await Shift.create([
    { id: 1, branch_id: BRANCH, name: 'Morning', start_time: '08:00', end_time: '16:00' },
    { id: 2, branch_id: BRANCH, name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
    { id: 3, branch_id: BRANCH, name: 'Evening', start_time: '16:00', end_time: '23:00' },
    { id: 4, branch_id: BRANCH, name: 'Night', start_time: '20:00', end_time: '04:00' },
  ]);
}

async function createAssignment(body) {
  const res = mockRes();
  await shiftAssignmentController.create({ body, branchId: BRANCH }, res);
  return res;
}

async function updateAssignment(id, body) {
  const res = mockRes();
  await shiftAssignmentController.update({ params: { id }, body }, res);
  return res;
}

const statusOf = (res) => res.status.mock.calls[0]?.[0];
const bodyOf = (res) => res.json.mock.calls[0][0];

function row(overrides = {}) {
  return {
    id: 1,
    employee_id: 1,
    shift_id: 1,
    branch_id: BRANCH,
    date: '2026-01-10',
    start_at: new Date('2026-01-10T08:00:00'),
    end_at: new Date('2026-01-10T16:00:00'),
    ...overrides,
  };
}

describe('create — overlap conflict validation', () => {
  beforeEach(seed);

  it('rejects a different shift that overlaps the employee\'s existing one', async () => {
    await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' }); // 08-16
    const res = await createAssignment({ employee_id: 1, shift_id: 2, date: '2026-01-10' }); // 14-22

    expect(statusOf(res)).toBe(409);
    expect(bodyOf(res)).toEqual(
      expect.objectContaining({
        code: 'SHIFT_OVERLAP',
        conflict: expect.objectContaining({ id: 1, shift_id: 1, date: '2026-01-10' }),
      }),
    );
    expect(await ShiftAssignment.countDocuments()).toBe(1);
  });

  it('allows back-to-back shifts (one ends exactly when the next starts)', async () => {
    await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' }); // 08-16
    const res = await createAssignment({ employee_id: 1, shift_id: 3, date: '2026-01-10' }); // 16-23

    expect(statusOf(res)).toBe(201);
    expect(await ShiftAssignment.countDocuments()).toBe(2);
  });

  it('catches an overnight shift colliding with the next day\'s morning shift', async () => {
    await createAssignment({ employee_id: 1, shift_id: 4, date: '2026-01-10' }); // 20:00 -> 04:00 (11th)
    const res = await createAssignment({
      employee_id: 1,
      shift_id: 1,
      date: '2026-01-11',
      start_at: '2026-01-11T03:00:00',
      end_at: '2026-01-11T09:00:00',
    });

    expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'SHIFT_OVERLAP' }));
    expect(statusOf(res)).toBe(409);
  });

  it('catches an explicit start_at/end_at range that overlaps', async () => {
    await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    const res = await createAssignment({
      employee_id: 1,
      shift_id: 3,
      date: '2026-01-10',
      start_at: '2026-01-10T15:30:00',
      end_at: '2026-01-10T18:00:00',
    });
    expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'SHIFT_OVERLAP' }));
  });

  it('keeps DUPLICATE_ASSIGNMENT for the exact same shift and date', async () => {
    await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    const res = await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'DUPLICATE_ASSIGNMENT' }));
  });

  it('does not let a cancelled assignment block a new one', async () => {
    await ShiftAssignment.create(row({ id: 100, status: 'CANCELLED' }));
    const res = await createAssignment({ employee_id: 1, shift_id: 2, date: '2026-01-10' });
    expect(statusOf(res)).toBe(201);
  });

  it('does not let another employee\'s shift block a new one', async () => {
    await createAssignment({ employee_id: 2, shift_id: 1, date: '2026-01-10' });
    const res = await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    expect(statusOf(res)).toBe(201);
  });

  it('rolls back and reports a conflict when a concurrent write slips past the pre-check', async () => {
    const realFind = shiftAssignmentRepository.findOverlapping;
    // The pre-check finds nothing, but a competing request lands before our insert completes.
    jest.spyOn(shiftAssignmentRepository, 'findOverlapping').mockImplementationOnce(async () => {
      await ShiftAssignment.create(row({ id: 50, shift_id: 2, start_at: new Date('2026-01-10T14:00:00'), end_at: new Date('2026-01-10T22:00:00') }));
      return null;
    });
    jest.spyOn(shiftAssignmentRepository, 'findOverlapping').mockImplementation(realFind);

    const res = await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' });

    expect(statusOf(res)).toBe(409);
    expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'SHIFT_OVERLAP' }));
    const remaining = await ShiftAssignment.find({});
    expect(remaining.map((a) => a.id)).toEqual([50]);
  });
});

describe('create — position', () => {
  beforeEach(seed);

  it('defaults to the employee\'s own Position', async () => {
    const res = await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    expect(statusOf(res)).toBe(201);
    expect((await ShiftAssignment.findOne({ id: 1 })).position_id).toBe(1);
  });

  it('accepts an explicit active Position different from the employee\'s own', async () => {
    const res = await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10', position_id: 2 });
    expect(statusOf(res)).toBe(201);
    expect((await ShiftAssignment.findOne({ id: 1 })).position_id).toBe(2);
  });

  it.each([
    ['unknown', 999],
    ['inactive', 3],
    ['non-numeric', 'abc'],
  ])('rejects a %s Position without creating anything', async (_label, position_id) => {
    const res = await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10', position_id });
    expect(statusOf(res)).toBe(400);
    expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'INVALID_POSITION' }));
    expect(await ShiftAssignment.countDocuments()).toBe(0);
  });

  it('still refuses an inactive employee', async () => {
    await Employee.updateOne({ id: 1 }, { status: 0 });
    const res = await createAssignment({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'EMPLOYEE_NOT_ACTIVE' }));
  });
});

describe('update', () => {
  beforeEach(async () => {
    await seed();
    await ShiftAssignment.create([
      row({ id: 1, shift_id: 1 }), // 08-16 on the 10th
      row({ id: 2, shift_id: 3, date: '2026-01-11', start_at: new Date('2026-01-11T16:00:00'), end_at: new Date('2026-01-11T23:00:00') }),
    ]);
  });

  it('rejects moving an assignment onto a time that overlaps another, leaving it untouched', async () => {
    const res = await updateAssignment(2, {
      date: '2026-01-10',
      start_at: '2026-01-10T12:00:00',
      end_at: '2026-01-10T18:00:00',
    });
    expect(statusOf(res)).toBe(409);
    expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'SHIFT_OVERLAP' }));
    const unchanged = await ShiftAssignment.findOne({ id: 2 });
    expect(unchanged.date).toBe('2026-01-11');
  });

  it('does not flag an assignment as conflicting with itself', async () => {
    const res = await updateAssignment(1, { start_at: '2026-01-10T07:00:00', end_at: '2026-01-10T17:00:00' });
    expect(res.status).not.toHaveBeenCalled();
    expect(bodyOf(res).id).toBe(1);
  });

  it('skips the overlap check when the same request cancels the assignment', async () => {
    const res = await updateAssignment(2, {
      status: 'CANCELLED',
      date: '2026-01-10',
      start_at: '2026-01-10T12:00:00',
      end_at: '2026-01-10T18:00:00',
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(bodyOf(res).status).toBe('CANCELLED');
  });

  describe('reactivating a cancelled assignment', () => {
    beforeEach(async () => {
      await ShiftAssignment.create(
        row({ id: 3, shift_id: 2, status: 'CANCELLED', start_at: new Date('2026-01-10T14:00:00'), end_at: new Date('2026-01-10T22:00:00') }),
      );
    });

    it('is rejected when it now overlaps a live assignment', async () => {
      const res = await updateAssignment(3, { status: 'ACTIVE' });
      expect(statusOf(res)).toBe(409);
      expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'SHIFT_OVERLAP' }));
      expect((await ShiftAssignment.findOne({ id: 3 })).status).toBe('CANCELLED');
    });

    it('is rejected when the employee has since been deactivated', async () => {
      await ShiftAssignment.updateOne({ id: 1 }, { status: 'CANCELLED' });
      await Employee.updateOne({ id: 1 }, { status: 0 });
      const res = await updateAssignment(3, { status: 'ACTIVE' });
      expect(bodyOf(res)).toEqual(expect.objectContaining({ code: 'EMPLOYEE_NOT_ACTIVE' }));
    });

    it('succeeds when the slot is free', async () => {
      await ShiftAssignment.updateOne({ id: 1 }, { status: 'CANCELLED' });
      const res = await updateAssignment(3, { status: 'ACTIVE' });
      expect(res.status).not.toHaveBeenCalled();
      expect(bodyOf(res).status).toBe('ACTIVE');
    });
  });

  it('lets an inactive employee\'s assignment still be cancelled', async () => {
    await Employee.updateOne({ id: 1 }, { status: 0 });
    const res = await updateAssignment(1, { status: 'CANCELLED' });
    expect(res.status).not.toHaveBeenCalled();
    expect(bodyOf(res).status).toBe('CANCELLED');
  });

  it('changes the Position to another active one and rejects an invalid one', async () => {
    const ok = await updateAssignment(1, { position_id: 2 });
    expect(bodyOf(ok).position_id).toBe(2);

    const bad = await updateAssignment(1, { position_id: 3 });
    expect(statusOf(bad)).toBe(400);
    expect(bodyOf(bad)).toEqual(expect.objectContaining({ code: 'INVALID_POSITION' }));
    expect((await ShiftAssignment.findOne({ id: 1 })).position_id).toBe(2);
  });

  it('restores the previous timing when a concurrent write wins the race', async () => {
    const realFind = shiftAssignmentRepository.findOverlapping;
    jest.spyOn(shiftAssignmentRepository, 'findOverlapping').mockImplementationOnce(async () => {
      await ShiftAssignment.create(row({ id: 60, shift_id: 2, start_at: new Date('2026-01-10T18:00:00'), end_at: new Date('2026-01-10T21:00:00') }));
      return null;
    });
    jest.spyOn(shiftAssignmentRepository, 'findOverlapping').mockImplementation(realFind);

    const res = await updateAssignment(2, {
      date: '2026-01-10',
      start_at: '2026-01-10T17:00:00',
      end_at: '2026-01-10T20:00:00',
    });

    expect(statusOf(res)).toBe(409);
    const restored = await ShiftAssignment.findOne({ id: 2 });
    expect(restored.date).toBe('2026-01-11');
    expect(restored.start_at.toISOString()).toBe(new Date('2026-01-11T16:00:00').toISOString());
  });
});

describe('list / listMine', () => {
  beforeEach(async () => {
    await seed();
    await ShiftAssignment.create([
      row({ id: 1, position_id: 2 }),
      row({ id: 2, employee_id: 2, branch_id: 9, shift_id: 9 }),
    ]);
  });

  it('lists every branch when no branch scope is set (Super Admin)', async () => {
    const res = mockRes();
    await shiftAssignmentController.list({ query: {}, branchId: null }, res);
    expect(bodyOf(res).total).toBe(2);
  });

  it('stays confined to one branch when a scope is set', async () => {
    const res = mockRes();
    await shiftAssignmentController.list({ query: {}, branchId: BRANCH }, res);
    const payload = bodyOf(res);
    expect(payload.total).toBe(1);
    expect(payload.data[0].position).toEqual({ code: 'CASHIER', name: 'Cashier' });
  });

  it('nests the Position on an employee\'s own schedule', async () => {
    const res = mockRes();
    await shiftAssignmentController.listMine({ query: {}, account: { accountId: 7 } }, res);
    expect(bodyOf(res).data[0].position).toEqual({ code: 'CASHIER', name: 'Cashier' });
  });

  it('leaves position undefined for a legacy assignment with none', async () => {
    await ShiftAssignment.updateOne({ id: 1 }, { $unset: { position_id: 1 } });
    const res = mockRes();
    await shiftAssignmentController.listMine({ query: {}, account: { accountId: 7 } }, res);
    expect(bodyOf(res).data[0].position).toBeUndefined();
  });
});
