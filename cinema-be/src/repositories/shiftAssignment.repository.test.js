const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const shiftAssignmentRepository = require('./shiftAssignment.repository');
const ShiftAssignment = require('../models/ShiftAssignment');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    employee_id: 1,
    shift_id: 1,
    branch_id: 1,
    date: '2026-01-10',
    start_at: new Date('2026-01-10T08:00:00'),
    end_at: new Date('2026-01-10T16:00:00'),
    ...overrides,
  };
}

describe('shiftAssignment.repository', () => {
  it('findBranchIdByAssignmentId returns the owning branch id', async () => {
    await ShiftAssignment.create(baseFields({ branch_id: 7 }));
    expect(await shiftAssignmentRepository.findBranchIdByAssignmentId(1)).toBe(7);
  });

  it('findBranchIdByAssignmentId returns null for an unknown assignment', async () => {
    expect(await shiftAssignmentRepository.findBranchIdByAssignmentId(999)).toBeNull();
  });

  it('findAll paginates and filters', async () => {
    await ShiftAssignment.create([
      baseFields({ id: 1, employee_id: 1 }),
      baseFields({ id: 2, employee_id: 2 }),
      baseFields({ id: 3, employee_id: 1, branch_id: 2 }),
    ]);
    const result = await shiftAssignmentRepository.findAll({ branch_id: 1 }, { skip: 0, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data.map((a) => a.id).sort()).toEqual([1, 2]);
  });

  it('findActiveDuplicate finds an existing active assignment for the same employee/shift/date', async () => {
    await ShiftAssignment.create(baseFields());
    const duplicate = await shiftAssignmentRepository.findActiveDuplicate({
      employee_id: 1,
      shift_id: 1,
      date: '2026-01-10',
    });
    expect(duplicate).not.toBeNull();
  });

  it('findActiveDuplicate ignores cancelled assignments', async () => {
    await ShiftAssignment.create(baseFields({ status: 'CANCELLED' }));
    const duplicate = await shiftAssignmentRepository.findActiveDuplicate({
      employee_id: 1,
      shift_id: 1,
      date: '2026-01-10',
    });
    expect(duplicate).toBeNull();
  });

  it('findActiveDuplicate excludes the given id', async () => {
    await ShiftAssignment.create(baseFields());
    const duplicate = await shiftAssignmentRepository.findActiveDuplicate({
      employee_id: 1,
      shift_id: 1,
      date: '2026-01-10',
      excludeId: 1,
    });
    expect(duplicate).toBeNull();
  });

  it('existsForShift reflects whether any assignment references the shift', async () => {
    expect(await shiftAssignmentRepository.existsForShift(1)).toBeFalsy();
    await ShiftAssignment.create(baseFields());
    expect(await shiftAssignmentRepository.existsForShift(1)).toBeTruthy();
  });

  it('create persists a new assignment', async () => {
    const assignment = await shiftAssignmentRepository.create(baseFields());
    expect(assignment.employee_id).toBe(1);
  });

  it('updateFields updates and returns the new document', async () => {
    await ShiftAssignment.create(baseFields());
    const updated = await shiftAssignmentRepository.updateFields(1, { status: 'CANCELLED' });
    expect(updated.status).toBe('CANCELLED');
  });

  it('remove deletes the assignment', async () => {
    await ShiftAssignment.create(baseFields());
    await shiftAssignmentRepository.remove(1);
    expect(await ShiftAssignment.countDocuments()).toBe(0);
  });
});
