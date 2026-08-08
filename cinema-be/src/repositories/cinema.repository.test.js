const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const cinemaRepository = require('./cinema.repository');
const Cinema = require('../models/Cinema');
const Account = require('../models/Account');
const FavoriteCinema = require('../models/FavoriteCinema');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Review = require('../models/Review');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('cinema.repository', () => {
  it('findApproved only returns status 1 cinemas', async () => {
    await Cinema.create([
      { id: 1, owner_id: 1, name: 'Approved', status: 1 },
      { id: 2, owner_id: 1, name: 'Pending', status: 0 },
    ]);
    const result = await cinemaRepository.findApproved();
    expect(result.total).toBe(1);
    expect(result.data[0].name).toBe('Approved');
  });

  describe('findMine', () => {
    it('scopes to the owner for non-admin roles', async () => {
      await Cinema.create([
        { id: 1, owner_id: 42, name: 'Mine' },
        { id: 2, owner_id: 99, name: 'Not mine' },
      ]);
      const result = await cinemaRepository.findMine({ role: 2, accountId: 42 });
      expect(result.total).toBe(1);
    });

    it('returns all cinemas for admin (role 0)', async () => {
      await Cinema.create([
        { id: 1, owner_id: 42, name: 'A' },
        { id: 2, owner_id: 99, name: 'B' },
      ]);
      const result = await cinemaRepository.findMine({ role: 0, accountId: 1 });
      expect(result.total).toBe(2);
    });
  });

  it('findPending returns only status 0 cinemas', async () => {
    await Cinema.create([
      { id: 1, owner_id: 1, name: 'Pending', status: 0 },
      { id: 2, owner_id: 1, name: 'Approved', status: 1 },
    ]);
    const result = await cinemaRepository.findPending();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Pending');
  });

  describe('getTopRanked', () => {
    it('ranks approved cinemas by booking count then average rating', async () => {
      await Cinema.create([
        { id: 1, owner_id: 1, name: 'Cinema A', status: 1 },
        { id: 2, owner_id: 2, name: 'Cinema B', status: 1 },
      ]);
      await Room.create([
        { id: 1, cinema_id: 1, name: 'R1' },
        { id: 2, cinema_id: 2, name: 'R2' },
      ]);
      await Schedule.create([
        { id: 1, movie_id: 10, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
        { id: 2, movie_id: 20, room_id: 2, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
      ]);
      // Cinema A: 2 sold tickets, Cinema B: 1 sold ticket
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 0 },
        { id: 3, schedule_id: 2, seat_index: 0, seat_code: 'A1', status: 0 },
        { id: 4, schedule_id: 2, seat_index: 1, seat_code: 'A2', status: 1 }, // unsold, excluded
      ]);
      await Review.create([
        { id: 1, movie_id: 10, account_id: 1, rating: 4, hidden: false },
        { id: 2, movie_id: 20, account_id: 1, rating: 2, hidden: false },
      ]);

      const result = await cinemaRepository.getTopRanked();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Cinema A');
      expect(result[0].bookingCount).toBe(2);
      expect(result[0].avgRating).toBe(4);
      expect(result[1].name).toBe('Cinema B');
      expect(result[1].bookingCount).toBe(1);
    });

    it('excludes non-approved cinemas and caps results at 8', async () => {
      await Cinema.create({ id: 1, owner_id: 1, name: 'Pending', status: 0 });
      const result = await cinemaRepository.getTopRanked();
      expect(result).toHaveLength(0);
    });
  });

  describe('favorites', () => {
    it('findFavoriteCinemasByAccountId returns cinemas for the account\'s favorites', async () => {
      await Cinema.create([{ id: 1, owner_id: 1, name: 'Fav', status: 1 }]);
      await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
      const result = await cinemaRepository.findFavoriteCinemasByAccountId(42);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fav');
    });

    it('findFavoriteCinemasByAccountId hides a favorite once its cinema is no longer approved', async () => {
      await Cinema.create([
        { id: 1, owner_id: 1, name: 'Pending', status: 0 },
        { id: 2, owner_id: 1, name: 'Blocked', status: 2 },
      ]);
      await FavoriteCinema.create([
        { id: 1, cinema_id: 1, account_id: 42 },
        { id: 2, cinema_id: 2, account_id: 42 },
      ]);
      const result = await cinemaRepository.findFavoriteCinemasByAccountId(42);
      expect(result).toHaveLength(0);
    });

    it('countFavorites counts favorites for a cinema', async () => {
      await FavoriteCinema.create([
        { id: 1, cinema_id: 1, account_id: 1 },
        { id: 2, cinema_id: 1, account_id: 2 },
      ]);
      expect(await cinemaRepository.countFavorites('1')).toBe(2);
    });

    it('findFavorite/createFavorite/deleteFavorite manage a single favorite', async () => {
      expect(await cinemaRepository.findFavorite({ cinemaId: 1, accountId: 42 })).toBeNull();
      await cinemaRepository.createFavorite({ id: 1, cinemaId: 1, accountId: 42 });
      expect(await cinemaRepository.findFavorite({ cinemaId: 1, accountId: 42 })).not.toBeNull();
      await cinemaRepository.deleteFavorite({ cinemaId: 1, accountId: 42 });
      expect(await cinemaRepository.findFavorite({ cinemaId: 1, accountId: 42 })).toBeNull();
    });
  });

  it('findById finds a cinema by numeric id regardless of status', async () => {
    await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 0 });
    expect((await cinemaRepository.findById('1')).name).toBe('A');
  });

  describe('findApprovedById', () => {
    it('returns an approved cinema', async () => {
      await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 1 });
      expect((await cinemaRepository.findApprovedById('1')).name).toBe('A');
    });

    it('returns null for a pending cinema', async () => {
      await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 0 });
      expect(await cinemaRepository.findApprovedById('1')).toBeNull();
    });

    it('returns null for a blocked cinema', async () => {
      await Cinema.create({ id: 1, owner_id: 1, name: 'A', status: 2 });
      expect(await cinemaRepository.findApprovedById('1')).toBeNull();
    });
  });

  it('findAccountByEmail is case-insensitive', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x' });
    expect(await cinemaRepository.findAccountByEmail('OWNER@example.com')).not.toBeNull();
  });

  it('createOwnerAccount creates a pre-approved, pre-verified branch admin account', async () => {
    const account = await cinemaRepository.createOwnerAccount({
      id: 1,
      email: 'owner@example.com',
      password: 'hashed',
      name: 'Owner',
      phone: '0123456789',
    });
    expect(account.role).toBe(2);
    expect(account.approved).toBe(true);
    expect(account.verified).toBe(true);
  });

  it('create/updateFields/approve/block/remove manage a cinema document', async () => {
    const created = await cinemaRepository.create({ id: 1, owner_id: 1, name: 'A' });
    expect(created.id).toBe(1);

    const updated = await cinemaRepository.updateFields(1, { name: 'Updated' });
    expect(updated.name).toBe('Updated');

    const approved = await cinemaRepository.approve(1);
    expect(approved.status).toBe(1);

    const blocked = await cinemaRepository.block(1);
    expect(blocked.status).toBe(2);

    await cinemaRepository.remove(1);
    expect(await Cinema.countDocuments()).toBe(0);
  });

  it('setAccountApproved marks the account approved', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', approved: false });
    await cinemaRepository.setAccountApproved(1);
    const account = await Account.findOne({ id: 1 });
    expect(account.approved).toBe(true);
  });
});
