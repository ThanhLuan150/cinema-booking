const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { assertMovieOwnership } = require('./movieOwnership');
const Movie = require('../models/Movie');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('assertMovieOwnership', () => {
  it('always allows an admin (role 0), even for an unknown movie', async () => {
    const allowed = await assertMovieOwnership({ account: { role: 0, accountId: 999 } }, 12345);
    expect(allowed).toBe(true);
  });

  it('denies when movieId is missing', async () => {
    const allowed = await assertMovieOwnership({ account: { role: 2, accountId: 1 } }, undefined);
    expect(allowed).toBe(false);
  });

  it('denies when the movie does not exist', async () => {
    const allowed = await assertMovieOwnership({ account: { role: 2, accountId: 1 } }, 999);
    expect(allowed).toBe(false);
  });

  it('denies a theater owner who did not create the movie', async () => {
    await Movie.create({ id: 1, owner_id: 99, name: 'A', premiere_date: '2026-01-01' });
    const allowed = await assertMovieOwnership({ account: { role: 2, accountId: 1 } }, 1);
    expect(allowed).toBe(false);
  });

  it('allows the theater owner who created the movie', async () => {
    await Movie.create({ id: 1, owner_id: 42, name: 'A', premiere_date: '2026-01-01' });
    const allowed = await assertMovieOwnership({ account: { role: 2, accountId: 42 } }, 1);
    expect(allowed).toBe(true);
  });
});
