const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const shiftAssignmentController = require('./shiftAssignment.controller');
const ShiftAssignment = require('../models/ShiftAssignment');
const Shift = require('../models/Shift');
const Employee = require('../models/Employee');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedEmployeeAndShift({ branchId = 5, employeeStatus = 1, shiftStatus = 'ACTIVE' } = {}) {
  await Employee.create({
    id: 1,
    user_id: 7,
    branch_id: branchId,
    employee_code: 'EMP-000001',
    position_id: 1,
    status: employeeStatus,
  });
  await Shift.create({
    id: 1,
    branch_id: branchId,
    name: 'Ca sáng',
    start_time: '08:00',
    end_time: '16:00',
    status: shiftStatus,
  });
}

describe('shiftAssignment.controller', () => {
  describe('create', () => {
    it('rejects missing fields', async () => {
      const res = mockRes();
      await shiftAssignmentController.create({ body: {}, branchId: 5 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects an invalid date format', async () => {
      await seedEmployeeAndShift();
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '10-01-2026' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_DATE_FORMAT' }));
    });

    it('returns 404 for an unknown employee', async () => {
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 999, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects an inactive employee', async () => {
      await seedEmployeeAndShift({ employeeStatus: 0 });
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'EMPLOYEE_NOT_ACTIVE' }));
    });

    it('returns 404 for an unknown shift', async () => {
      await Employee.create({ id: 1, user_id: 7, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 999, date: '2026-01-10' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('rejects an inactive shift', async () => {
      await seedEmployeeAndShift({ shiftStatus: 'INACTIVE' });
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SHIFT_NOT_ACTIVE' }));
    });

    it('rejects assigning an employee to a shift of a different branch (no cross-branch assignment)', async () => {
      await Employee.create({ id: 1, user_id: 7, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      await Shift.create({ id: 1, branch_id: 9, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BRANCH_MISMATCH' }));
    });

    it('creates an assignment, deriving start_at/end_at from the shift template', async () => {
      await seedEmployeeAndShift();
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const assignment = await ShiftAssignment.findOne({ employee_id: 1 });
      expect(assignment.branch_id).toBe(5);
      expect(assignment.status).toBe('ACTIVE');
      expect(assignment.start_at.toISOString()).toBe(new Date('2026-01-10T08:00:00').toISOString());
      expect(assignment.end_at.toISOString()).toBe(new Date('2026-01-10T16:00:00').toISOString());
    });

    it('rolls an overnight shift end_at to the following day', async () => {
      await Employee.create({ id: 1, user_id: 7, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca đêm', start_time: '16:00', end_time: '00:00' });
      const res = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const assignment = await ShiftAssignment.findOne({ employee_id: 1 });
      expect(assignment.start_at.toISOString()).toBe(new Date('2026-01-10T16:00:00').toISOString());
      expect(assignment.end_at.toISOString()).toBe(new Date('2026-01-11T00:00:00').toISOString());
    });

    it('rejects a duplicate active assignment for the same employee/shift/date', async () => {
      await seedEmployeeAndShift();
      const res1 = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res1,
      );
      const res2 = mockRes();
      await shiftAssignmentController.create(
        { body: { employee_id: 1, shift_id: 1, date: '2026-01-10' }, branchId: 5 },
        res2,
      );
      expect(res2.status).toHaveBeenCalledWith(409);
      expect(res2.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DUPLICATE_ASSIGNMENT' }));
    });

    it('rejects an explicit end_at that is not after start_at', async () => {
      await seedEmployeeAndShift();
      const res = mockRes();
      await shiftAssignmentController.create(
        {
          body: {
            employee_id: 1,
            shift_id: 1,
            date: '2026-01-10',
            start_at: '2026-01-10T10:00:00',
            end_at: '2026-01-10T09:00:00',
          },
          branchId: 5,
        },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TIME_RANGE' }));
    });
  });

  describe('update', () => {
    async function seedAssignment(overrides = {}) {
      await seedEmployeeAndShift();
      return ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 5,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
        ...overrides,
      });
    }

    it('returns 404 for an unknown assignment', async () => {
      const res = mockRes();
      await shiftAssignmentController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates status without touching start_at/end_at', async () => {
      await seedAssignment();
      const res = mockRes();
      await shiftAssignmentController.update({ params: { id: 1 }, body: { status: 'CANCELLED' } }, res);
      const updated = await ShiftAssignment.findOne({ id: 1 });
      expect(updated.status).toBe('CANCELLED');
      expect(updated.start_at.toISOString()).toBe(new Date('2026-01-10T08:00:00').toISOString());
    });

    it('rejects an invalid status', async () => {
      await seedAssignment();
      const res = mockRes();
      await shiftAssignmentController.update({ params: { id: 1 }, body: { status: 'BOGUS' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('recomputes start_at/end_at when the date changes', async () => {
      await seedAssignment();
      const res = mockRes();
      await shiftAssignmentController.update({ params: { id: 1 }, body: { date: '2026-01-11' } }, res);
      expect(res.status).not.toHaveBeenCalledWith(400);
      const updated = await ShiftAssignment.findOne({ id: 1 });
      expect(updated.date).toBe('2026-01-11');
      expect(updated.start_at.toISOString()).toBe(new Date('2026-01-11T08:00:00').toISOString());
    });

    it('rejects moving to a shift in a different branch', async () => {
      await seedAssignment();
      await Shift.create({ id: 2, branch_id: 9, name: 'Ca chiều', start_time: '16:00', end_time: '00:00' });
      const res = mockRes();
      await shiftAssignmentController.update({ params: { id: 1 }, body: { shift_id: 2 } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'BRANCH_MISMATCH' }));
    });

    it('rejects a change that collides with another active assignment', async () => {
      await seedAssignment();
      await ShiftAssignment.create({
        id: 2,
        employee_id: 1,
        shift_id: 1,
        branch_id: 5,
        date: '2026-01-11',
        start_at: new Date('2026-01-11T08:00:00'),
        end_at: new Date('2026-01-11T16:00:00'),
      });
      const res = mockRes();
      await shiftAssignmentController.update({ params: { id: 1 }, body: { date: '2026-01-11' } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DUPLICATE_ASSIGNMENT' }));
    });
  });

  describe('list', () => {
    it('returns assignments scoped to req.branchId with optional filters', async () => {
      await ShiftAssignment.create([
        {
          id: 1,
          employee_id: 1,
          shift_id: 1,
          branch_id: 5,
          date: '2026-01-10',
          start_at: new Date('2026-01-10T08:00:00'),
          end_at: new Date('2026-01-10T16:00:00'),
        },
        {
          id: 2,
          employee_id: 2,
          shift_id: 1,
          branch_id: 5,
          date: '2026-01-11',
          start_at: new Date('2026-01-11T08:00:00'),
          end_at: new Date('2026-01-11T16:00:00'),
        },
        {
          id: 3,
          employee_id: 1,
          shift_id: 1,
          branch_id: 9,
          date: '2026-01-10',
          start_at: new Date('2026-01-10T08:00:00'),
          end_at: new Date('2026-01-10T16:00:00'),
        },
      ]);
      const res = mockRes();
      await shiftAssignmentController.list({ query: { employeeId: '1' }, branchId: 5 }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(1);
      expect(payload.data[0].id).toBe(1);
    });
  });

  describe('listMine', () => {
    it('returns an empty page when the caller has no Employee profile', async () => {
      const res = mockRes();
      await shiftAssignmentController.listMine({ query: {}, account: { accountId: 7 } }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(0);
      expect(payload.data).toEqual([]);
    });

    it("returns only the caller's own assignments", async () => {
      await Employee.create({ id: 1, user_id: 7, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      await ShiftAssignment.create([
        {
          id: 1,
          employee_id: 1,
          shift_id: 1,
          branch_id: 5,
          date: '2026-01-10',
          start_at: new Date('2026-01-10T08:00:00'),
          end_at: new Date('2026-01-10T16:00:00'),
        },
        {
          id: 2,
          employee_id: 2,
          shift_id: 1,
          branch_id: 5,
          date: '2026-01-10',
          start_at: new Date('2026-01-10T08:00:00'),
          end_at: new Date('2026-01-10T16:00:00'),
        },
      ]);
      const res = mockRes();
      await shiftAssignmentController.listMine({ query: {}, account: { accountId: 7 } }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(1);
      expect(payload.data[0].id).toBe(1);
    });

    it('nests a read-only shift summary onto each assignment', async () => {
      await Employee.create({ id: 1, user_id: 7, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 5,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = mockRes();
      await shiftAssignmentController.listMine({ query: {}, account: { accountId: 7 } }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.data[0].shift).toEqual({ name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    });

    it('filters by from/to date range', async () => {
      await Employee.create({ id: 1, user_id: 7, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      await ShiftAssignment.create([
        {
          id: 1,
          employee_id: 1,
          shift_id: 1,
          branch_id: 5,
          date: '2026-01-05',
          start_at: new Date('2026-01-05T08:00:00'),
          end_at: new Date('2026-01-05T16:00:00'),
        },
        {
          id: 2,
          employee_id: 1,
          shift_id: 1,
          branch_id: 5,
          date: '2026-01-15',
          start_at: new Date('2026-01-15T08:00:00'),
          end_at: new Date('2026-01-15T16:00:00'),
        },
      ]);
      const res = mockRes();
      await shiftAssignmentController.listMine(
        { query: { from: '2026-01-10', to: '2026-01-20' }, account: { accountId: 7 } },
        res,
      );
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(1);
      expect(payload.data[0].id).toBe(2);
    });
  });

  describe('remove', () => {
    it('returns 404 for an unknown assignment', async () => {
      const res = mockRes();
      await shiftAssignmentController.remove({ params: { id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('deletes the assignment', async () => {
      await ShiftAssignment.create({
        id: 1,
        employee_id: 1,
        shift_id: 1,
        branch_id: 5,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T08:00:00'),
        end_at: new Date('2026-01-10T16:00:00'),
      });
      const res = mockRes();
      await shiftAssignmentController.remove({ params: { id: 1 } }, res);
      expect(await ShiftAssignment.findOne({ id: 1 })).toBeNull();
    });
  });
});
