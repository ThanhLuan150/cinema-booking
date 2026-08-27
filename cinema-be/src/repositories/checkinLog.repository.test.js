const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const checkinLogRepository = require('./checkinLog.repository');
const CheckinLog = require('../models/CheckinLog');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('checkinLog.repository', () => {
  it('record() auto-assigns an id and persists the row', async () => {
    const log = await checkinLogRepository.record({ branch_id: 1, device_id: 2, result: 'SUCCESS' });
    expect(log.id).toBeGreaterThan(0);
    expect(await CheckinLog.countDocuments()).toBe(1);
  });

  it('findFiltered filters by branch/device/result, newest first, paginated', async () => {
    await checkinLogRepository.record({ branch_id: 1, device_id: 1, result: 'SUCCESS' });
    await checkinLogRepository.record({ branch_id: 1, device_id: 2, result: 'REJECTED', reason: 'BRANCH_MISMATCH' });
    await checkinLogRepository.record({ branch_id: 2, device_id: 3, result: 'SUCCESS' });

    const byBranch = await checkinLogRepository.findFiltered({ branch_id: 1 }, { skip: 0, limit: 20 });
    expect(byBranch.total).toBe(2);
    expect(byBranch.data[0].id).toBeGreaterThan(byBranch.data[1].id); // sorted desc

    const rejected = await checkinLogRepository.findFiltered({ branch_id: 1, result: 'REJECTED' }, { skip: 0, limit: 20 });
    expect(rejected.total).toBe(1);
    expect(rejected.data[0].reason).toBe('BRANCH_MISMATCH');
  });
});
