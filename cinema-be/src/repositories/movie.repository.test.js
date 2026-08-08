const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieRepository = require('./movie.repository');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Schedule = require('../models/Schedule');
const Room = require('../models/Room');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movie.repository', () => {
  it('findCategoryMovieIds returns movie ids mapped to a category', async () => {
    await MovieCategory.create([
      { id: 1, movie_id: 10, cat_id: 1 },
      { id: 2, movie_id: 20, cat_id: 1 },
      { id: 3, movie_id: 30, cat_id: 2 },
    ]);
    const ids = await movieRepository.findCategoryMovieIds(1);
    expect(ids.sort()).toEqual([10, 20]);
  });

  describe('findScheduleMovieIds', () => {
    async function seed() {
      await Room.create([
        { id: 1, cinema_id: 1, name: 'R1' },
        { id: 2, cinema_id: 2, name: 'R2' },
      ]);
      await Schedule.create([
        { id: 1, movie_id: 100, room_id: 1, cinema_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
        { id: 2, movie_id: 200, room_id: 2, cinema_id: 2, movie_date: '2026-01-02', time_begin: '10:00', time_end: '12:00', price: 1 },
      ]);
    }

    it('filters by date', async () => {
      await seed();
      const ids = await movieRepository.findScheduleMovieIds({ date: '2026-01-01' });
      expect(ids).toEqual([100]);
    });

    it('filters by cinema', async () => {
      await seed();
      const ids = await movieRepository.findScheduleMovieIds({ cinema: 2 });
      expect(ids).toEqual([200]);
    });

    it('returns all unique movie ids with no filters', async () => {
      await seed();
      const ids = await movieRepository.findScheduleMovieIds({});
      expect(ids.sort()).toEqual([100, 200]);
    });

    it('excludes movies whose only showtime is cancelled', async () => {
      await seed();
      await Schedule.updateOne({ id: 2 }, { $set: { status: 'CANCELLED' } });
      const ids = await movieRepository.findScheduleMovieIds({});
      expect(ids).toEqual([100]);
    });
  });

  it('findFiltered paginates on an arbitrary filter', async () => {
    await Movie.create([
      { id: 1, name: 'A', premiere_date: '2026-01-01' },
      { id: 2, name: 'B', premiere_date: '2026-01-02' },
    ]);
    const result = await movieRepository.findFiltered({ id: 1 });
    expect(result.total).toBe(1);
  });

  it('findById finds a movie by numeric id', async () => {
    await Movie.create({ id: 1, name: 'A', premiere_date: '2026-01-01' });
    expect((await movieRepository.findById('1')).name).toBe('A');
  });

  it('findMine returns the whole company-wide catalog regardless of who created each movie', async () => {
    await Movie.create([
      { id: 1, owner_id: 42, name: 'Mine', premiere_date: '2026-01-01' },
      { id: 2, owner_id: 99, name: 'Not mine', premiere_date: '2026-01-01' },
    ]);
    const all = await movieRepository.findMine({});
    expect(all.total).toBe(2);
  });

  it('findMine filters by status when provided', async () => {
    await Movie.create([
      { id: 1, name: 'Active One', premiere_date: '2026-01-01', status: 'ACTIVE' },
      { id: 2, name: 'Disabled One', premiere_date: '2026-01-01', status: 'INACTIVE' },
    ]);
    const active = await movieRepository.findMine({ status: 'ACTIVE' });
    expect(active.total).toBe(1);
    expect(active.data[0].name).toBe('Active One');

    const inactive = await movieRepository.findMine({ status: 'INACTIVE' });
    expect(inactive.total).toBe(1);
    expect(inactive.data[0].name).toBe('Disabled One');
  });

  it('create/updateFields/remove manage a movie document', async () => {
    const created = await movieRepository.create({ id: 1, name: 'A', premiere_date: '2026-01-01' });
    expect(created.id).toBe(1);

    const updated = await movieRepository.updateFields(1, { name: 'Updated' });
    expect(updated.name).toBe('Updated');

    await movieRepository.remove(1);
    expect(await Movie.countDocuments()).toBe(0);
  });
});
