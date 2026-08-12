const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const shiftController = require('./shift.controller');
const Shift = require('../models/Shift');
const ShiftAssignment = require('../models/ShiftAssignment');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('shift.controller', () => {
  describe('list', () => {
    it('returns shifts scoped to req.branchId', async () => {
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      await Shift.create({ id: 2, branch_id: 9, name: 'Ca chiều', start_time: '16:00', end_time: '00:00' });
      const res = mockRes();
      await shiftController.list({ query: {}, branchId: 5 }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.total).toBe(1);
      expect(payload.data[0].id).toBe(1);
    });
  });

  describe('create', () => {
    it('rejects missing fields', async () => {
      const res = mockRes();
      await shiftController.create({ body: {}, branchId: 5 }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects an invalid time format', async () => {
      const res = mockRes();
      await shiftController.create(
        { body: { name: 'Ca sáng', start_time: '8:00', end_time: '16:00' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TIME_FORMAT' }));
    });

    it('rejects equal start_time and end_time', async () => {
      const res = mockRes();
      await shiftController.create(
        { body: { name: 'Ca sáng', start_time: '08:00', end_time: '08:00' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_TIME_RANGE' }));
    });

    it('creates a shift scoped to req.branchId', async () => {
      const res = mockRes();
      await shiftController.create(
        { body: { name: 'Ca sáng', start_time: '08:00', end_time: '16:00' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      const shift = await Shift.findOne({ name: 'Ca sáng' });
      expect(shift.branch_id).toBe(5);
      expect(shift.status).toBe('ACTIVE');
    });

    it('allows an overnight shift (end_time earlier than start_time)', async () => {
      const res = mockRes();
      await shiftController.create(
        { body: { name: 'Ca đêm', start_time: '16:00', end_time: '00:00' }, branchId: 5 },
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown shift', async () => {
      const res = mockRes();
      await shiftController.update({ params: { id: 999 }, body: {} }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('updates name', async () => {
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      const res = mockRes();
      await shiftController.update({ params: { id: 1 }, body: { name: 'Ca sáng mới' } }, res);
      const updated = await Shift.findOne({ id: 1 });
      expect(updated.name).toBe('Ca sáng mới');
    });

    it('rejects an invalid time format on partial update', async () => {
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      const res = mockRes();
      await shiftController.update({ params: { id: 1 }, body: { start_time: 'bogus' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rejects an invalid status', async () => {
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      const res = mockRes();
      await shiftController.update({ params: { id: 1 }, body: { status: 'BOGUS' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('updates status to INACTIVE', async () => {
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      const res = mockRes();
      await shiftController.update({ params: { id: 1 }, body: { status: 'INACTIVE' } }, res);
      const updated = await Shift.findOne({ id: 1 });
      expect(updated.status).toBe('INACTIVE');
    });
  });

  describe('remove', () => {
    it('returns 404 for an unknown shift', async () => {
      const res = mockRes();
      await shiftController.remove({ params: { id: 999 } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('refuses to delete a shift that has assignments', async () => {
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
      await shiftController.remove({ params: { id: 1 } }, res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SHIFT_HAS_ASSIGNMENTS' }));
      expect(await Shift.findOne({ id: 1 })).not.toBeNull();
    });

    it('deletes a shift with no assignments', async () => {
      await Shift.create({ id: 1, branch_id: 5, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
      const res = mockRes();
      await shiftController.remove({ params: { id: 1 } }, res);
      expect(await Shift.findOne({ id: 1 })).toBeNull();
    });
  });
});
