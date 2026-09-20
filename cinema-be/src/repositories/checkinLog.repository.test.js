jest.mock('../utils/socket'); // src/utils/__mocks__/socket.js — every emit helper, auto-stubbed

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const checkinLogRepository = require('./checkinLog.repository');
const socket = require('../utils/socket');
const CheckinLog = require('../models/CheckinLog');

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

describe('checkinLog.repository', () => {
  it('record() auto-assigns an id and persists the row', async () => {
    const log = await checkinLogRepository.record({ branch_id: 1, device_id: 2, result: 'SUCCESS' });
    expect(log.id).toBeGreaterThan(0);
    expect(await CheckinLog.countDocuments()).toBe(1);
  });

  // Both check-in channels — the staff desk (booking.controller) and the QR scanners
  // (device.controller) — write their log through here, which is why the door feed is pushed
  // from the repository rather than from either controller.
  it('record() pushes the check-in to the branch and to super admin', async () => {
    const log = await checkinLogRepository.record({
      branch_id: 1,
      device_id: 2,
      entrance_id: 3,
      invoice_id: 4,
      result: 'SUCCESS',
    });

    expect(socket.emitBranchEvent).toHaveBeenCalledWith(1, 'checkin:new', {
      checkinLogId: log.id,
      invoiceId: 4,
      deviceId: 2,
      entranceId: 3,
      result: 'SUCCESS',
    });
  });

  it('record() pushes a rejected scan too — that is the one staff most need to see', async () => {
    await checkinLogRepository.record({ branch_id: 1, result: 'REJECTED', reason: 'BRANCH_MISMATCH' });

    expect(socket.emitBranchEvent).toHaveBeenCalledWith(
      1,
      'checkin:new',
      expect.objectContaining({ result: 'REJECTED' }),
    );
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
