const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const SignageSchedule = require('./SignageSchedule');

beforeAll(async () => {
  await connect();
  await SignageSchedule.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    content_id: 1,
    screen_id: 1,
    start_at: new Date('2026-01-01T00:00:00Z'),
    end_at: new Date('2026-02-01T00:00:00Z'),
    ...overrides,
  };
}

describe('SignageSchedule model', () => {
  it('creates a valid playlist entry with defaults', async () => {
    const entry = await SignageSchedule.create(baseFields());
    expect(entry.priority).toBe(0);
    expect(entry.status).toBe('ACTIVE');
  });

  it('fails validation when required fields are missing', () => {
    const err = new SignageSchedule({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.content_id).toBeDefined();
    expect(err.errors.screen_id).toBeDefined();
    expect(err.errors.start_at).toBeDefined();
    expect(err.errors.end_at).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new SignageSchedule(baseFields({ status: 'PAUSED' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });
});
