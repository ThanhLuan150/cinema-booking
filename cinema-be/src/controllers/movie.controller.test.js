jest.mock('../utils/socket', () => ({ emitPublic: jest.fn(), emitToAdmin: jest.fn(), emitToOwner: jest.fn() }));
jest.mock('../utils/uploadImage', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://cdn.example.com/avatar.jpg'),
  uploadTrailer: jest.fn().mockResolvedValue('https://cdn.example.com/trailer.mp4'),
}));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const movieController = require('./movie.controller');
const socket = require('../utils/socket');
const uploadImage = require('../utils/uploadImage');
const Movie = require('../models/Movie');
const MovieCategory = require('../models/MovieCategory');
const Category = require('../models/Category');
const MovieActor = require('../models/MovieActor');
const Actor = require('../models/Actor');
const MovieDirector = require('../models/MovieDirector');
const Director = require('../models/Director');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

describe('movie.controller list', () => {
  it('filters by search term, case-insensitively', async () => {
    await Movie.create([
      { id: 1, name: 'The Matrix', premiere_date: '2026-01-01' },
      { id: 2, name: 'Inception', premiere_date: '2026-01-01' },
    ]);
    const res = mockRes();
    await movieController.list({ query: { search: 'matrix' } }, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.total).toBe(1);
    expect(payload.data[0].name).toBe('The Matrix');
  });

  it('filters by category', async () => {
    await Movie.create([
      { id: 1, name: 'A', premiere_date: '2026-01-01' },
      { id: 2, name: 'B', premiere_date: '2026-01-01' },
    ]);
    await Category.create({ id: 1, name: 'Action' });
    await MovieCategory.create({ id: 1, movie_id: 1, cat_id: 1 });
    const res = mockRes();
    await movieController.list({ query: { category: 1 } }, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.total).toBe(1);
    expect(payload.data[0].categories.map((c) => c.name)).toEqual(['Action']);
  });

  it('attaches actors and directors to each movie', async () => {
    await Movie.create({ id: 1, name: 'A', premiere_date: '2026-01-01' });
    await Actor.create({ id: 1, full_name: 'Actor One' });
    await MovieActor.create({ id: 1, movie_id: 1, actor_id: 1, character_name: 'Hero', is_lead: true });
    await Director.create({ id: 1, full_name: 'Director One' });
    await MovieDirector.create({ id: 1, movie_id: 1, director_id: 1 });

    const res = mockRes();
    await movieController.list({ query: {} }, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data[0].actors).toEqual([
      expect.objectContaining({ full_name: 'Actor One', character_name: 'Hero', is_lead: true }),
    ]);
    expect(payload.data[0].directors).toEqual([expect.objectContaining({ full_name: 'Director One' })]);
  });

  it('excludes INACTIVE movies from the public catalog', async () => {
    await Movie.create([
      { id: 1, name: 'Active One', premiere_date: '2026-01-01', status: 'ACTIVE' },
      { id: 2, name: 'Disabled One', premiere_date: '2026-01-01', status: 'INACTIVE' },
    ]);
    const res = mockRes();
    await movieController.list({ query: {} }, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.total).toBe(1);
    expect(payload.data[0].name).toBe('Active One');
  });
});

describe('movie.controller getById', () => {
  it('returns 404 for an unknown movie', async () => {
    const res = mockRes();
    await movieController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('attaches categories to the found movie', async () => {
    await Movie.create({ id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = mockRes();
    await movieController.getById({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, categories: [], actors: [], directors: [] }),
    );
  });
});

describe('movie.controller create', () => {
  it('rejects missing name or premiere_date', async () => {
    const res = mockRes();
    await movieController.create({ body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a movie and broadcasts movie:new', async () => {
    const res = mockRes();
    await movieController.create(
      { body: { name: 'New Movie', premiere_date: '2026-01-01' }, account: { accountId: 42 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const created = await Movie.findOne({ name: 'New Movie' });
    expect(created.owner_id).toBe(42);
    expect(socket.emitPublic).toHaveBeenCalledWith('movie:new', expect.objectContaining({ name: 'New Movie' }));
  });

  it('uploads the avatar file when provided instead of using the avatar url', async () => {
    const res = mockRes();
    await movieController.create(
      {
        body: { name: 'With File', premiere_date: '2026-01-01' },
        account: { accountId: 1 },
        files: { avatar: [{ buffer: Buffer.from('x') }] },
      },
      res,
    );
    expect(uploadImage.uploadImage).toHaveBeenCalled();
    const created = await Movie.findOne({ name: 'With File' });
    expect(created.avatar).toBe('https://cdn.example.com/avatar.jpg');
  });
});

describe('movie.controller update/remove', () => {
  it('returns 404 for an unknown movie', async () => {
    const res = mockRes();
    await movieController.update({ params: { id: 999 }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('applies only whitelisted fields', async () => {
    await Movie.create({ id: 1, name: 'Old', premiere_date: '2026-01-01' });
    const res = mockRes();
    await movieController.update(
      { params: { id: 1 }, body: { name: 'New', owner_id: 999 }, account: { role: 0, accountId: 1 } },
      res,
    );
    const updated = await Movie.findOne({ id: 1 });
    expect(updated.name).toBe('New');
    expect(updated.owner_id).toBeNull();
  });

  it('rejects an invalid status value', async () => {
    await Movie.create({ id: 1, name: 'Old', premiere_date: '2026-01-01' });
    const res = mockRes();
    await movieController.update(
      { params: { id: 1 }, body: { status: 'RETIRED' }, account: { role: 0, accountId: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('allows updating status to INACTIVE', async () => {
    await Movie.create({ id: 1, name: 'Old', premiere_date: '2026-01-01' });
    const res = mockRes();
    await movieController.update(
      { params: { id: 1 }, body: { status: 'INACTIVE' }, account: { role: 0, accountId: 1 } },
      res,
    );
    const updated = await Movie.findOne({ id: 1 });
    expect(updated.status).toBe('INACTIVE');
  });

  it('remove deletes the movie', async () => {
    await Movie.create({ id: 1, name: 'A', premiere_date: '2026-01-01' });
    const res = mockRes();
    await movieController.remove({ params: { id: 1 }, account: { role: 0, accountId: 1 } }, res);
    expect(await Movie.countDocuments()).toBe(0);
  });
});
