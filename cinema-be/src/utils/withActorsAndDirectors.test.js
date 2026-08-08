const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { withActorsAndDirectors } = require('./withActorsAndDirectors');
const Actor = require('../models/Actor');
const Director = require('../models/Director');
const MovieActor = require('../models/MovieActor');
const MovieDirector = require('../models/MovieDirector');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('withActorsAndDirectors', () => {
  it('attaches matching actors and directors to each movie', async () => {
    await Actor.create([{ id: 1, full_name: 'Actor A' }, { id: 2, full_name: 'Actor B' }]);
    await Director.create({ id: 1, full_name: 'Director A' });
    await MovieActor.create([
      { id: 1, movie_id: 100, actor_id: 1, character_name: 'Hero', is_lead: true },
      { id: 2, movie_id: 100, actor_id: 2 },
      { id: 3, movie_id: 200, actor_id: 2 },
    ]);
    await MovieDirector.create({ id: 1, movie_id: 100, director_id: 1 });

    const movies = [{ id: 100, name: 'Movie A' }, { id: 200, name: 'Movie B' }];
    const result = await withActorsAndDirectors(movies);

    const movieA = result.find((m) => m.id === 100);
    const movieB = result.find((m) => m.id === 200);
    expect(movieA.actors.map((a) => a.full_name).sort()).toEqual(['Actor A', 'Actor B']);
    expect(movieA.actors.find((a) => a.full_name === 'Actor A').character_name).toBe('Hero');
    expect(movieA.actors.find((a) => a.full_name === 'Actor A').is_lead).toBe(true);
    expect(movieA.directors.map((d) => d.full_name)).toEqual(['Director A']);
    expect(movieB.actors.map((a) => a.full_name)).toEqual(['Actor B']);
    expect(movieB.directors).toEqual([]);
  });

  it('gives empty arrays to a movie with no mappings', async () => {
    const result = await withActorsAndDirectors([{ id: 999, name: 'Uncast' }]);
    expect(result[0].actors).toEqual([]);
    expect(result[0].directors).toEqual([]);
  });

  it('ignores mappings that point at a non-existent actor/director', async () => {
    await MovieActor.create({ id: 1, movie_id: 300, actor_id: 999 });
    await MovieDirector.create({ id: 1, movie_id: 300, director_id: 999 });
    const result = await withActorsAndDirectors([{ id: 300, name: 'Movie C' }]);
    expect(result[0].actors).toEqual([]);
    expect(result[0].directors).toEqual([]);
  });

  it('calls toJSON on mongoose documents instead of spreading raw internals', async () => {
    const movieDoc = { id: 400, toJSON: () => ({ id: 400, name: 'Via toJSON' }) };
    const result = await withActorsAndDirectors([movieDoc]);
    expect(result[0]).toEqual({ id: 400, name: 'Via toJSON', actors: [], directors: [] });
  });
});
