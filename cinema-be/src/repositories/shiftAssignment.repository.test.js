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

  describe('findOverlapping', () => {
    const at = (iso) => new Date(iso);

    it('finds a partially overlapping assignment', async () => {
      await ShiftAssignment.create(baseFields());
      const found = await shiftAssignmentRepository.findOverlapping({
        employee_id: 1,
        start_at: at('2026-01-10T15:00:00'),
        end_at: at('2026-01-10T20:00:00'),
      });
      expect(found.id).toBe(1);
    });

    it('finds an assignment that fully contains, or is contained by, the range', async () => {
      await ShiftAssignment.create(baseFields());
      const containing = await shiftAssignmentRepository.findOverlapping({
        employee_id: 1,
        start_at: at('2026-01-10T09:00:00'),
        end_at: at('2026-01-10T10:00:00'),
      });
      const contained = await shiftAssignmentRepository.findOverlapping({
        employee_id: 1,
        start_at: at('2026-01-10T06:00:00'),
        end_at: at('2026-01-10T22:00:00'),
      });
      expect(containing).not.toBeNull();
      expect(contained).not.toBeNull();
    });

    it('treats back-to-back shifts as non-overlapping', async () => {
      await ShiftAssignment.create(baseFields());
      const after = await shiftAssignmentRepository.findOverlapping({
        employee_id: 1,
        start_at: at('2026-01-10T16:00:00'),
        end_at: at('2026-01-10T22:00:00'),
      });
      const before = await shiftAssignmentRepository.findOverlapping({
        employee_id: 1,
        start_at: at('2026-01-10T00:00:00'),
        end_at: at('2026-01-10T08:00:00'),
      });
      expect(after).toBeNull();
      expect(before).toBeNull();
    });

    it('catches an overnight shift spilling into the next calendar day', async () => {
      await ShiftAssignment.create(
        baseFields({ start_at: at('2026-01-10T20:00:00'), end_at: at('2026-01-11T04:00:00') }),
      );
      const found = await shiftAssignmentRepository.findOverlapping({
        employee_id: 1,
        start_at: at('2026-01-11T02:00:00'),
        end_at: at('2026-01-11T10:00:00'),
      });
      expect(found).not.toBeNull();
    });

    it('ignores cancelled assignments, other employees and the excluded id', async () => {
      await ShiftAssignment.create([
        baseFields({ id: 1, status: 'CANCELLED' }),
        baseFields({ id: 2, employee_id: 2 }),
        baseFields({ id: 3 }),
      ]);
      const range = { start_at: at('2026-01-10T09:00:00'), end_at: at('2026-01-10T10:00:00') };
      expect((await shiftAssignmentRepository.findOverlapping({ employee_id: 1, ...range })).id).toBe(3);
      expect(await shiftAssignmentRepository.findOverlapping({ employee_id: 1, ...range, excludeId: 3 })).toBeNull();
    });
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
