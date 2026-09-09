const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const SignageContent = require('./SignageContent');

beforeAll(async () => {
  await connect();
  await SignageContent.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, branch_id: 1, type: 'ANNOUNCEMENT', title: 'Welcome', ...overrides };
}

describe('SignageContent model', () => {
  it('creates a valid content row with defaults', async () => {
    const content = await SignageContent.create(baseFields());
    expect(content.status).toBe('ACTIVE');
    expect(content.body).toBe('');
    expect(content.movie_id).toBeNull();
    expect(content.schedule_id).toBeNull();
    expect(content.promotion_id).toBeNull();
  });

  it('fails validation when required fields are missing', () => {
    const err = new SignageContent({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.title).toBeDefined();
  });

  it('rejects an unknown type', () => {
    const err = new SignageContent(baseFields({ type: 'VIDEO' })).validateSync();
    expect(err.errors.type).toBeDefined();
  });

  it('exposes the six supported content types', () => {
    expect(SignageContent.TYPES).toEqual([
      'MOVIE_POSTER',
      'SHOWTIME',
      'COMING_SOON',
      'PROMOTION',
      'ADVERTISEMENT',
      'ANNOUNCEMENT',
    ]);
  });
});
