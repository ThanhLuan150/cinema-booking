const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const entranceRepository = require('./entrance.repository');
const Entrance = require('../models/Entrance');
const Device = require('../models/Device');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, branch_id: 1, name: 'Main lobby', ...overrides };
}

describe('entrance.repository', () => {
  it('filters and paginates by branch', async () => {
    await Entrance.create([baseFields({ id: 1, branch_id: 1 }), baseFields({ id: 2, branch_id: 2 })]);
    const { data, total } = await entranceRepository.findFiltered({ branch_id: 1 }, { skip: 0, limit: 20 });
    expect(total).toBe(1);
    expect(data[0].id).toBe(1);
  });

  it('resolves the branch id for an entrance and null for an unknown one', async () => {
    await Entrance.create(baseFields());
    expect(await entranceRepository.findBranchIdByEntranceId(1)).toBe(1);
    expect(await entranceRepository.findBranchIdByEntranceId(999)).toBeNull();
  });

  it('finds a same-branch code clash but ignores the excluded id', async () => {
    await Entrance.create(baseFields({ id: 1, code: 'G1' }));
    expect(await entranceRepository.findByBranchAndCode(1, 'G1')).not.toBeNull();
    expect(await entranceRepository.findByBranchAndCode(1, 'G1', { excludeId: 1 })).toBeNull();
    expect(await entranceRepository.findByBranchAndCode(2, 'G1')).toBeNull();
  });

  it('counts devices still pinned to an entrance', async () => {
    await Entrance.create(baseFields());
    await Device.create({ id: 1, device_id: 'D1', name: 'S', branch_id: 1, entrance_id: 1, api_key_hash: 'x' });
    expect(await entranceRepository.countDevices(1)).toBe(1);
    expect(await entranceRepository.countDevices(2)).toBe(0);
  });

  it('creates, updates and removes', async () => {
    await entranceRepository.create(baseFields());
    const updated = await entranceRepository.updateFields(1, { name: 'Gate B', status: 'INACTIVE' });
    expect(updated.name).toBe('Gate B');
    expect(updated.status).toBe('INACTIVE');
    await entranceRepository.remove(1);
    expect(await Entrance.findOne({ id: 1 })).toBeNull();
  });
});
