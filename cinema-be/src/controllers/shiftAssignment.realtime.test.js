// Ticket 44 — realtime: who hears about a shift change, and that a refused/rolled-back write
// never leaks a broadcast.
jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const shiftAssignmentController = require('./shiftAssignment.controller');
const shiftAssignmentRepository = require('../repositories/shiftAssignment.repository');
const socket = require('../utils/socket');
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
beforeEach(async () => {
  await Employee.create({ id: 1, user_id: 77, branch_id: 5, employee_code: 'EMP-000001', position_id: 1, status: 1 });
  await Shift.create([
    { id: 1, branch_id: 5, name: 'Morning', start_time: '08:00', end_time: '16:00' },
    { id: 2, branch_id: 5, name: 'Afternoon', start_time: '14:00', end_time: '22:00' },
  ]);
});
afterEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await clearDatabase();
});
afterAll(async () => closeDatabase());

const create = async (body) => {
  const res = mockRes();
  await shiftAssignmentController.create({ body, branchId: 5 }, res);
  return res;
};
const update = async (id, body) => {
  const res = mockRes();
  await shiftAssignmentController.update({ params: { id }, body }, res);
  return res;
};

const myShiftCalls = () => socket.emitToAccount.mock.calls.filter(([, event]) => event === 'myShift:updated');

describe('shift assignment realtime', () => {
  it('on create: roster board gets shift:updated, the employee gets myShift:updated', async () => {
    const res = await create({ employee_id: 1, shift_id: 1, date: '2026-01-10', position_id: undefined });
    expect(res.status).toHaveBeenCalledWith(201);

    expect(socket.emitBranchEvent).toHaveBeenCalledTimes(1);
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(
      5,
      'shift:updated',
      expect.objectContaining({ action: 'CREATED', employeeId: 1, shiftId: 1, positionId: 1, date: '2026-01-10' }),
    );

    expect(myShiftCalls()).toHaveLength(1);
    expect(socket.emitToAccount).toHaveBeenCalledWith(
      77,
      'myShift:updated',
      expect.objectContaining({
        action: 'CREATED',
        date: '2026-01-10',
        status: 'ACTIVE',
        positionId: 1,
        startAt: expect.any(Date),
        endAt: expect.any(Date),
      }),
    );
  });

  it('never sends shift:updated down the account room (one event name, one channel)', async () => {
    await create({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    const eventsToAccount = socket.emitToAccount.mock.calls.map(([, event]) => event);
    expect(eventsToAccount).not.toContain('shift:updated');
  });

  it('carries the explicitly chosen Position', async () => {
    const Position = require('../models/Position');
    await Position.create({ id: 2, code: 'CASHIER', name: 'Cashier', status: 1 });
    await create({ employee_id: 1, shift_id: 1, date: '2026-01-10', position_id: 2 });
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(5, 'shift:updated', expect.objectContaining({ positionId: 2 }));
    expect(socket.emitToAccount).toHaveBeenCalledWith(77, 'myShift:updated', expect.objectContaining({ positionId: 2 }));
  });

  it('on cancel: both audiences hear the new status; on delete: both hear DELETED', async () => {
    await create({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    jest.clearAllMocks();

    await update(1, { status: 'CANCELLED' });
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(
      5,
      'shift:updated',
      expect.objectContaining({ action: 'UPDATED', status: 'CANCELLED' }),
    );
    expect(socket.emitToAccount).toHaveBeenCalledWith(
      77,
      'myShift:updated',
      expect.objectContaining({ action: 'UPDATED', status: 'CANCELLED' }),
    );

    jest.clearAllMocks();
    const res = mockRes();
    await shiftAssignmentController.remove({ params: { id: 1 } }, res);
    expect(socket.emitBranchEvent).toHaveBeenCalledWith(5, 'shift:updated', expect.objectContaining({ action: 'DELETED' }));
    expect(socket.emitToAccount).toHaveBeenCalledWith(77, 'myShift:updated', expect.objectContaining({ action: 'DELETED' }));
  });

  it('does not broadcast when a request is refused (overlap, invalid position, inactive employee)', async () => {
    await create({ employee_id: 1, shift_id: 1, date: '2026-01-10' });
    jest.clearAllMocks();

    await create({ employee_id: 1, shift_id: 2, date: '2026-01-10' }); // overlaps 08-16
    await create({ employee_id: 1, shift_id: 2, date: '2026-01-11', position_id: 999 });
    await Employee.updateOne({ id: 1 }, { status: 0 });
    await create({ employee_id: 1, shift_id: 2, date: '2026-01-12' });

    expect(socket.emitBranchEvent).not.toHaveBeenCalled();
    expect(socket.emitToAccount).not.toHaveBeenCalled();
  });

  it('does not broadcast a write that lost the concurrent-overlap race and was rolled back', async () => {
    const realFind = shiftAssignmentRepository.findOverlapping;
    jest.spyOn(shiftAssignmentRepository, 'findOverlapping').mockImplementationOnce(async () => {
      await ShiftAssignment.create({
        id: 50,
        employee_id: 1,
        shift_id: 2,
        branch_id: 5,
        date: '2026-01-10',
        start_at: new Date('2026-01-10T14:00:00'),
        end_at: new Date('2026-01-10T22:00:00'),
      });
      return null;
    });
    jest.spyOn(shiftAssignmentRepository, 'findOverlapping').mockImplementation(realFind);

    const res = await create({ employee_id: 1, shift_id: 1, date: '2026-01-10' });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(socket.emitBranchEvent).not.toHaveBeenCalled();
    expect(socket.emitToAccount).not.toHaveBeenCalled();
  });

  it('a socket failure is logged but does not fail an already-committed write', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    socket.emitBranchEvent.mockImplementationOnce(() => {
      throw new Error('socket down');
    });

    const res = await create({ employee_id: 1, shift_id: 1, date: '2026-01-10' });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(await ShiftAssignment.countDocuments()).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      '[shiftAssignment] failed to broadcast',
      expect.anything(),
      'socket down',
    );
  });
});
