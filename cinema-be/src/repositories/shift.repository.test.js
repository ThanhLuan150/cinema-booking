const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const shiftRepository = require('./shift.repository');
const Shift = require('../models/Shift');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('shift.repository', () => {
  it('findBranchIdByShiftId returns the owning branch id', async () => {
    await Shift.create({ id: 1, branch_id: 7, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    expect(await shiftRepository.findBranchIdByShiftId(1)).toBe(7);
  });

  it('findBranchIdByShiftId returns null for an unknown shift', async () => {
    expect(await shiftRepository.findBranchIdByShiftId(999)).toBeNull();
  });

  it('findAll paginates and filters by branch_id', async () => {
    await Shift.create([
      { id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' },
      { id: 2, branch_id: 1, name: 'Ca chiều', start_time: '16:00', end_time: '00:00' },
      { id: 3, branch_id: 2, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' },
    ]);
    const result = await shiftRepository.findAll({ branch_id: 1 }, { skip: 0, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data.map((s) => s.id).sort()).toEqual([1, 2]);
  });

  it('findById returns the shift', async () => {
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const shift = await shiftRepository.findById(1);
    expect(shift.name).toBe('Ca sáng');
  });

  it('create persists a new shift', async () => {
    const shift = await shiftRepository.create({
      id: 1,
      branch_id: 1,
      name: 'Ca sáng',
      start_time: '08:00',
      end_time: '16:00',
      status: 'ACTIVE',
    });
    expect(shift.name).toBe('Ca sáng');
  });

  it('updateFields updates and returns the new document', async () => {
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    const updated = await shiftRepository.updateFields(1, { name: 'Ca sáng mới' });
    expect(updated.name).toBe('Ca sáng mới');
  });

  it('findByIds returns the matching shifts only', async () => {
    await Shift.create([
      { id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' },
      { id: 2, branch_id: 1, name: 'Ca chiều', start_time: '16:00', end_time: '00:00' },
      { id: 3, branch_id: 2, name: 'Ca đêm', start_time: '00:00', end_time: '08:00' },
    ]);
    const shifts = await shiftRepository.findByIds([1, 3]);
    expect(shifts.map((s) => s.id).sort()).toEqual([1, 3]);
  });

  it('remove deletes the shift', async () => {
    await Shift.create({ id: 1, branch_id: 1, name: 'Ca sáng', start_time: '08:00', end_time: '16:00' });
    await shiftRepository.remove(1);
    expect(await Shift.countDocuments()).toBe(0);
  });
});
