jest.mock('../utils/socket', () => ({ emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitPublic: jest.fn() }));

const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const cinemaController = require('./cinema.controller');
const socket = require('../utils/socket');
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
    await Cinema.create({ id: 1, owner_id: 1, name: 'Fav', status: 1 });
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

  it('returns 404 for a pending (not yet approved) cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 0 });
    const res = mockRes();
    await cinemaController.getById({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 404 for a blocked cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 2 });
    const res = mockRes();
    await cinemaController.getById({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns an approved cinema', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 1 });
    const res = mockRes();
    await cinemaController.getById({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ name: 'A' }));
  });
});

describe('cinema.controller createBranchAdmin', () => {
  it('rejects missing email, password or cinema_name', async () => {
    const res = mockRes();
    await cinemaController.createBranchAdmin({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a duplicate email', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x' });
    const res = mockRes();
    await cinemaController.createBranchAdmin(
      { body: { email: 'owner@example.com', password: 'pw', cinema_name: 'My Cinema' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('creates a pre-approved, pre-verified branch admin account and cinema', async () => {
    const res = mockRes();
    await cinemaController.createBranchAdmin(
      { body: { email: 'owner@example.com', password: 'pw', name: 'Owner', phone: '0123456789', cinema_name: 'My Cinema', city: 'HN' } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);

    const account = await Account.findOne({ email: 'owner@example.com' });
    expect(account.role).toBe(2);
    expect(account.approved).toBe(true);
    expect(account.verified).toBe(true);

    const cinema = await Cinema.findOne({ owner_id: account.id });
    expect(cinema.name).toBe('My Cinema');
    expect(cinema.status).toBe(1);
  });
});

describe('cinema.controller create', () => {
  it('rejects a missing name', async () => {
    const res = mockRes();
    await cinemaController.create({ body: {}, account: { role: 0, accountId: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('always creates a pre-approved branch (single company, no pending workflow)', async () => {
    const res = mockRes();
    await cinemaController.create({ body: { name: 'New Branch' }, account: { role: 0, accountId: 1 } }, res);
    const created = await Cinema.findOne({ name: 'New Branch' });
    expect(created.status).toBe(1);
    expect(created.owner_id).toBe(1);
  });

  it('assigns the given owner_id to the new branch when provided', async () => {
    const res = mockRes();
    await cinemaController.create(
      { body: { name: 'New Branch', owner_id: 42 }, account: { role: 0, accountId: 1 } },
      res,
    );
    const created = await Cinema.findOne({ name: 'New Branch' });
    expect(created.owner_id).toBe(42);
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
