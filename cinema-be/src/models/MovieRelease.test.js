const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const MovieRelease = require('./MovieRelease');

beforeAll(async () => {
  await connect();
  await MovieRelease.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('MovieRelease model', () => {
  it('creates a valid release and applies defaults', async () => {
    const r = await MovieRelease.create({ id: 1, movie_id: 1, distributor_id: 1, release_date: '2026-03-10' });
    expect(r.status).toBe('ACTIVE');
    expect(r.end_date).toBeNull();
  });

  it('fails validation when required fields are missing', () => {
    const err = new MovieRelease({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.movie_id).toBeDefined();
    expect(err.errors.distributor_id).toBeDefined();
    expect(err.errors.release_date).toBeDefined();
  });

  it('enforces one release per (movie_id, distributor_id) pair', async () => {
    await MovieRelease.create({ id: 1, movie_id: 5, distributor_id: 2, release_date: '2026-03-10' });
    await expect(
      MovieRelease.create({ id: 2, movie_id: 5, distributor_id: 2, release_date: '2026-04-10' }),
    ).rejects.toThrow();
    // Same movie, different distributor is allowed.
    await expect(
      MovieRelease.create({ id: 3, movie_id: 5, distributor_id: 3, release_date: '2026-04-10' }),
    ).resolves.toBeDefined();
  });
});
