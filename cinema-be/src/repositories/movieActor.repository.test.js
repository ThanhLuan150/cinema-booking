const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieActorRepository = require('./movieActor.repository');
const MovieActor = require('../models/MovieActor');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movieActor.repository', () => {
  it('findByMovieId returns only mappings for that movie', async () => {
    await MovieActor.create([
      { id: 1, movie_id: 1, actor_id: 1 },
      { id: 2, movie_id: 2, actor_id: 2 },
    ]);
    const result = await movieActorRepository.findByMovieId(1);
    expect(result).toHaveLength(1);
    expect(result[0].actor_id).toBe(1);
  });

  it('findByMovieIds returns mappings for several movies', async () => {
    await MovieActor.create([
      { id: 1, movie_id: 1, actor_id: 1 },
      { id: 2, movie_id: 2, actor_id: 2 },
      { id: 3, movie_id: 3, actor_id: 3 },
    ]);
    const result = await movieActorRepository.findByMovieIds([1, 2]);
    expect(result).toHaveLength(2);
  });

  it('create persists character_name and is_lead', async () => {
    const mapping = await movieActorRepository.create({
      id: 1,
      movie_id: 1,
      actor_id: 1,
      character_name: 'Hero',
      is_lead: true,
    });
    expect(mapping.character_name).toBe('Hero');
    expect(mapping.is_lead).toBe(true);
  });

  it('deleteByMovieId removes all mappings for that movie', async () => {
    await MovieActor.create([
      { id: 1, movie_id: 1, actor_id: 1 },
      { id: 2, movie_id: 1, actor_id: 2 },
      { id: 3, movie_id: 2, actor_id: 3 },
    ]);
    await movieActorRepository.deleteByMovieId(1);
    expect(await MovieActor.countDocuments()).toBe(1);
  });
});
