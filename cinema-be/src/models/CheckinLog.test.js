const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const CheckinLog = require('./CheckinLog');

beforeAll(async () => {
  await connect();
  await CheckinLog.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, branch_id: 1, result: 'SUCCESS', ...overrides };
}

describe('CheckinLog model', () => {
  it('creates a valid log row and stamps checked_in_at', async () => {
    const log = await CheckinLog.create(baseFields());
    expect(log.checked_in_at).toBeInstanceOf(Date);
    expect(log.device_id).toBeNull();
    expect(log.checked_in_by).toBeNull();
  });

  it('requires id, branch_id and result', () => {
    const err = new CheckinLog({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.result).toBeDefined();
  });

  it('rejects an unknown result', () => {
    const err = new CheckinLog(baseFields({ result: 'MAYBE' })).validateSync();
    expect(err.errors.result).toBeDefined();
  });

  it('accepts a REJECTED row with a reason', async () => {
    const log = await CheckinLog.create(baseFields({ result: 'REJECTED', reason: 'BRANCH_MISMATCH', device_id: 3 }));
    expect(log.result).toBe('REJECTED');
    expect(log.reason).toBe('BRANCH_MISMATCH');
  });
});
