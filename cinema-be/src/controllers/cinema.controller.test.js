jest.mock('../utils/socket', () => ({ emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitPublic: jest.fn() }));
jest.mock('../utils/uploadImage', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://cdn.example.com/cinema.jpg'),
}));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const cinemaController = require('./cinema.controller');
const socket = require('../utils/socket');
const uploadImage = require('../utils/uploadImage');
const Cinema = require('../models/Cinema');
const Account = require('../models/Account');
const FavoriteCinema = require('../models/FavoriteCinema');

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

describe('cinema.controller list/mine/pending/top', () => {
  it('list returns only approved cinemas', async () => {
    await Cinema.create([
      { id: 1, owner_id: 1, name: 'Approved', status: 1 },
      { id: 2, owner_id: 1, name: 'Pending', status: 0 },
    ]);
    const res = mockRes();
    await cinemaController.list({ query: {} }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('mine scopes to the caller\'s own cinemas', async () => {
    await Cinema.create([
      { id: 1, owner_id: 42, name: 'Mine' },
      { id: 2, owner_id: 99, name: 'Not mine' },
    ]);
    const res = mockRes();
    await cinemaController.mine({ query: {}, account: { role: 2, accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
  });

  it('pending returns only status 0 cinemas', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 0 });
    const res = mockRes();
    await cinemaController.pending({}, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
  });

  it('top returns the ranked list', async () => {
    const res = mockRes();
    await cinemaController.top({}, res);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe('cinema.controller favorites', () => {
  it('favorite creates a new favorite, then returns the existing one on repeat', async () => {
    const req = { body: { cinema_id: 1 }, account: { accountId: 42 } };
    const res1 = mockRes();
    await cinemaController.favorite(req, res1);
    expect(res1.status).toHaveBeenCalledWith(201);

    const res2 = mockRes();
    await cinemaController.favorite(req, res2);
    expect(res2.status).toHaveBeenCalledWith(200);
    expect(await FavoriteCinema.countDocuments()).toBe(1);
  });

  it('favorite rejects a missing cinema_id', async () => {
    const res = mockRes();
    await cinemaController.favorite({ body: {}, account: { accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('unfavorite removes the favorite', async () => {
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
    const res = mockRes();
    await cinemaController.unfavorite({ body: { cinema_id: 1 }, account: { accountId: 42 } }, res);
    expect(await FavoriteCinema.countDocuments()).toBe(0);
  });

  it('favoritesMine returns the caller\'s favorited cinemas', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'Fav' });
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
    const res = mockRes();
    await cinemaController.favoritesMine({ account: { accountId: 42 } }, res);
    expect(res.json).toHaveBeenCalledWith([expect.objectContaining({ name: 'Fav' })]);
  });

  it('favoriteCount returns the count for a cinema', async () => {
    await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
    const res = mockRes();
    await cinemaController.favoriteCount({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(1);
  });
});

describe('cinema.controller getById', () => {
  it('returns 404 for an unknown cinema', async () => {
    const res = mockRes();
    await cinemaController.getById({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('cinema.controller onboard', () => {
  it('rejects missing email or name', async () => {
    const res = mockRes();
    await cinemaController.onboard({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 for an unknown account', async () => {
    const res = mockRes();
    await cinemaController.onboard({ body: { email: 'nobody@example.com', name: 'A', phone: '0123456789' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('rejects an account that is not a theater owner', async () => {
    await Account.create({ id: 1, email: 'user@example.com', password: 'x', role: 1 });
    const res = mockRes();
    await cinemaController.onboard({ body: { email: 'user@example.com', name: 'A', phone: '0123456789' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates the cinema and notifies admins', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x', role: 2 });
    const res = mockRes();
    await cinemaController.onboard(
      { body: { email: 'owner@example.com', name: 'My Cinema', phone: '0123456789' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(socket.emitToAdmin).toHaveBeenCalledWith('cinema:pending', expect.objectContaining({ name: 'My Cinema' }));
  });

  it('saves the owner name and phone onto the account', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x', role: 2 });
    const res = mockRes();
    await cinemaController.onboard(
      { body: { email: 'owner@example.com', name: 'My Cinema', phone: '0123456789' } },
      res,
    );
    const account = await Account.findOne({ email: 'owner@example.com' });
    expect(account.name).toBe('My Cinema');
    expect(account.phone).toBe('0123456789');
  });

  it('uploads and saves the owner avatar onto the account when a file is provided', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x', role: 2 });
    const res = mockRes();
    await cinemaController.onboard(
      {
        body: { email: 'owner@example.com', name: 'My Cinema', phone: '0123456789' },
        files: { avatar: [{ buffer: Buffer.from('x') }] },
      },
      res,
    );
    expect(uploadImage.uploadImage).toHaveBeenCalledWith(expect.objectContaining({ buffer: expect.any(Buffer) }), 'cinemas/owners');
    const account = await Account.findOne({ email: 'owner@example.com' });
    expect(account.avatar).toBe('https://cdn.example.com/cinema.jpg');
  });

  it('leaves the existing avatar untouched when no file is submitted', async () => {
    await Account.create({
      id: 1,
      email: 'owner@example.com',
      password: 'x',
      role: 2,
      avatar: 'https://cdn.example.com/existing.jpg',
    });
    const res = mockRes();
    await cinemaController.onboard(
      { body: { email: 'owner@example.com', name: 'My Cinema', phone: '0123456789' } },
      res,
    );
    const account = await Account.findOne({ email: 'owner@example.com' });
    expect(account.avatar).toBe('https://cdn.example.com/existing.jpg');
  });

  it('uploads cinema venue photos and saves their URLs', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x', role: 2 });
    const res = mockRes();
    await cinemaController.onboard(
      {
        body: { email: 'owner@example.com', name: 'My Cinema', phone: '0123456789' },
        files: { images: [{ buffer: Buffer.from('a') }, { buffer: Buffer.from('b') }] },
      },
      res,
    );
    const cinema = await Cinema.findOne({ name: 'My Cinema' });
    expect(cinema.images).toEqual(['https://cdn.example.com/cinema.jpg', 'https://cdn.example.com/cinema.jpg']);
  });

  it('leaves existing venue photos untouched when none are submitted', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x', role: 2 });
    await Cinema.create({ id: 1, owner_id: 1, name: 'My Cinema', images: ['https://cdn.example.com/old.jpg'] });
    const res = mockRes();
    await cinemaController.onboard(
      { body: { email: 'owner@example.com', name: 'My Cinema', phone: '0123456789' } },
      res,
    );
    const cinema = await Cinema.findOne({ name: 'My Cinema' });
    expect(cinema.images).toEqual(['https://cdn.example.com/old.jpg']);
  });
});

describe('cinema.controller create', () => {
  it('rejects a missing name', async () => {
    const res = mockRes();
    await cinemaController.create({ body: {}, account: { role: 2, accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('auto-approves cinemas created by an admin', async () => {
    const res = mockRes();
    await cinemaController.create({ body: { name: 'Admin Cinema' }, account: { role: 0, accountId: 1 } }, res);
    const created = await Cinema.findOne({ name: 'Admin Cinema' });
    expect(created.status).toBe(1);
    expect(socket.emitToAdmin).not.toHaveBeenCalled();
  });

  it('leaves an owner-created cinema pending and notifies admins', async () => {
    const res = mockRes();
    await cinemaController.create({ body: { name: 'Owner Cinema' }, account: { role: 2, accountId: 42 } }, res);
    const created = await Cinema.findOne({ name: 'Owner Cinema' });
    expect(created.status).toBe(0);
    expect(created.owner_id).toBe(42);
    expect(socket.emitToAdmin).toHaveBeenCalledWith('cinema:pending', expect.objectContaining({ name: 'Owner Cinema' }));
  });
});

describe('cinema.controller approve/block/remove', () => {
  it('approve returns 404 for an unknown cinema', async () => {
    const res = mockRes();
    await cinemaController.approve({ params: { id: 999 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('approve sets status and approves the owner account', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A', status: 0 });
    await Account.create({ id: 42, email: 'owner@example.com', password: 'x', approved: false });
    const res = mockRes();
    await cinemaController.approve({ params: { id: 1 } }, res);
    expect((await Cinema.findOne({ id: 1 })).status).toBe(1);
    expect((await Account.findOne({ id: 42 })).approved).toBe(true);
    expect(socket.emitToOwner).toHaveBeenCalledWith(42, 'cinema:approved', expect.anything());
  });

  it('block sets status to blocked', async () => {
    await Cinema.create({ id: 1, owner_id: 42, name: 'A', status: 1 });
    const res = mockRes();
    await cinemaController.block({ params: { id: 1 } }, res);
    expect((await Cinema.findOne({ id: 1 })).status).toBe(2);
  });

  it('remove deletes the cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'A' });
    const res = mockRes();
    await cinemaController.remove({ params: { id: 1 } }, res);
    expect(await Cinema.countDocuments()).toBe(0);
  });
});
