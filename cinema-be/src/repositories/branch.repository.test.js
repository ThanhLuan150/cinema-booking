const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const branchRepository = require('./branch.repository');
const Branch = require('../models/Branch');
const Account = require('../models/Account');
const Employee = require('../models/Employee');
const Room = require('../models/Room');
const FavoriteCinema = require('../models/FavoriteCinema');
const Schedule = require('../models/Schedule');
const Ticket = require('../models/Ticket');
const Review = require('../models/Review');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('branch.repository', () => {
  it('findActive only returns ACTIVE branches', async () => {
    await Branch.create([
      { id: 1, company_id: 1, owner_id: 1, name: 'Active', code: 'A', status: 'ACTIVE' },
      { id: 2, company_id: 1, owner_id: 1, name: 'Inactive', code: 'B', status: 'INACTIVE' },
    ]);
    const result = await branchRepository.findActive();
    expect(result.total).toBe(1);
    expect(result.data[0].name).toBe('Active');
  });

  describe('findMine', () => {
    it('scopes to the owner for non-admin roles', async () => {
      await Branch.create([
        { id: 1, company_id: 1, owner_id: 42, name: 'Mine', code: 'A' },
        { id: 2, company_id: 1, owner_id: 99, name: 'Not mine', code: 'B' },
      ]);
      const result = await branchRepository.findMine({ role: 2, accountId: 42 });
      expect(result.total).toBe(1);
      expect(result.data[0].name).toBe('Mine');
    });

    it('returns every branch across every company for admin (role 0), enriched with owner info', async () => {
      await Account.create({ id: 42, email: 'owner@b.com', password: 'x', name: 'Owner Bob', phone: '0123' });
      await Branch.create([
        { id: 1, company_id: 1, owner_id: 42, name: 'A', code: 'A' },
        { id: 2, company_id: 2, owner_id: 99, name: 'B', code: 'B' },
      ]);
      const result = await branchRepository.findMine({ role: 0, accountId: 1 });
      expect(result.total).toBe(2);
      const withOwner = result.data.find((b) => b.owner_id === 42);
      expect(withOwner.owner_name).toBe('Owner Bob');
    });
  });

  describe('getTopRanked', () => {
    it('ranks active branches by booking count then average rating', async () => {
      await Branch.create([
        { id: 1, company_id: 1, owner_id: 1, name: 'Branch A', code: 'A', status: 'ACTIVE' },
        { id: 2, company_id: 1, owner_id: 2, name: 'Branch B', code: 'B', status: 'ACTIVE' },
      ]);
      await Room.create([
        { id: 1, cinema_id: 1, name: 'R1' },
        { id: 2, cinema_id: 2, name: 'R2' },
      ]);
      await Schedule.create([
        { id: 1, movie_id: 10, room_id: 1, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
        { id: 2, movie_id: 20, room_id: 2, movie_date: '2026-01-01', time_begin: '10:00', time_end: '12:00', price: 1 },
      ]);
      await Ticket.create([
        { id: 1, schedule_id: 1, seat_index: 0, seat_code: 'A1', status: 0 },
        { id: 2, schedule_id: 1, seat_index: 1, seat_code: 'A2', status: 0 },
        { id: 3, schedule_id: 2, seat_index: 0, seat_code: 'A1', status: 0 },
        { id: 4, schedule_id: 2, seat_index: 1, seat_code: 'A2', status: 1 },
      ]);
      await Review.create([
        { id: 1, movie_id: 10, account_id: 1, rating: 4, hidden: false },
        { id: 2, movie_id: 20, account_id: 1, rating: 2, hidden: false },
      ]);

      const result = await branchRepository.getTopRanked();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Branch A');
      expect(result[0].bookingCount).toBe(2);
      expect(result[0].avgRating).toBe(4);
      expect(result[1].name).toBe('Branch B');
      expect(result[1].bookingCount).toBe(1);
    });

    it('excludes non-active branches', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'Inactive', code: 'A', status: 'INACTIVE' });
      const result = await branchRepository.getTopRanked();
      expect(result).toHaveLength(0);
    });
  });

  describe('favorites', () => {
    it('findFavoriteBranchesByAccountId returns branches for the account\'s favorites', async () => {
      await Branch.create([{ id: 1, company_id: 1, owner_id: 1, name: 'Fav', code: 'A', status: 'ACTIVE' }]);
      await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
      const result = await branchRepository.findFavoriteBranchesByAccountId(42);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Fav');
    });

    it('findFavoriteBranchesByAccountId hides a favorite once its branch is no longer active', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'Inactive', code: 'A', status: 'INACTIVE' });
      await FavoriteCinema.create({ id: 1, cinema_id: 1, account_id: 42 });
      const result = await branchRepository.findFavoriteBranchesByAccountId(42);
      expect(result).toHaveLength(0);
    });

    it('countFavorites counts favorites for a branch', async () => {
      await FavoriteCinema.create([
        { id: 1, cinema_id: 1, account_id: 1 },
        { id: 2, cinema_id: 1, account_id: 2 },
      ]);
      expect(await branchRepository.countFavorites('1')).toBe(2);
    });

    it('findFavorite/createFavorite/deleteFavorite manage a single favorite', async () => {
      expect(await branchRepository.findFavorite({ branchId: 1, accountId: 42 })).toBeNull();
      await branchRepository.createFavorite({ id: 1, branchId: 1, accountId: 42 });
      expect(await branchRepository.findFavorite({ branchId: 1, accountId: 42 })).not.toBeNull();
      await branchRepository.deleteFavorite({ branchId: 1, accountId: 42 });
      expect(await branchRepository.findFavorite({ branchId: 1, accountId: 42 })).toBeNull();
    });
  });

  it('findById finds a branch by numeric id regardless of status', async () => {
    await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A', status: 'MAINTENANCE' });
    expect((await branchRepository.findById('1')).name).toBe('A');
  });

  describe('findActiveById', () => {
    it('returns an active branch', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A', status: 'ACTIVE' });
      expect((await branchRepository.findActiveById('1')).name).toBe('A');
    });

    it('returns null for an inactive branch', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A', status: 'INACTIVE' });
      expect(await branchRepository.findActiveById('1')).toBeNull();
    });

    it('returns null for a branch under maintenance', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A', status: 'MAINTENANCE' });
      expect(await branchRepository.findActiveById('1')).toBeNull();
    });
  });

  it('findAccountByEmail is case-insensitive', async () => {
    await Account.create({ id: 1, email: 'owner@example.com', password: 'x' });
    expect(await branchRepository.findAccountByEmail('OWNER@example.com')).not.toBeNull();
  });

  it('createOwnerAccount creates a pre-approved, pre-verified branch admin account', async () => {
    const account = await branchRepository.createOwnerAccount({
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

  it('create/updateFields/setStatus/assignAdmin/remove manage a branch document', async () => {
    const created = await branchRepository.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
    expect(created.id).toBe(1);

    const updated = await branchRepository.updateFields(1, { name: 'Updated' });
    expect(updated.name).toBe('Updated');

    const disabled = await branchRepository.setStatus(1, 'INACTIVE');
    expect(disabled.status).toBe('INACTIVE');

    const maintained = await branchRepository.setStatus(1, 'MAINTENANCE');
    expect(maintained.status).toBe('MAINTENANCE');

    const activated = await branchRepository.setStatus(1, 'ACTIVE');
    expect(activated.status).toBe('ACTIVE');

    const reassigned = await branchRepository.assignAdmin(1, 99);
    expect(reassigned.owner_id).toBe(99);

    await branchRepository.remove(1);
    expect(await Branch.countDocuments()).toBe(0);
  });

  it('setAccountApproved marks the account approved', async () => {
    await Account.create({ id: 1, email: 'a@b.com', password: 'x', approved: false });
    await branchRepository.setAccountApproved(1);
    const account = await Account.findOne({ id: 1 });
    expect(account.approved).toBe(true);
  });

  describe('hasDependents', () => {
    it('is false for a branch with no employees or rooms', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
      expect(await branchRepository.hasDependents(1)).toBe(false);
    });

    it('is true when the branch has an active employee', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
      await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 1 });
      expect(await branchRepository.hasDependents(1)).toBe(true);
    });

    it('is false when the only employee is deactivated', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
      await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'EMP-000001', position_id: 1, status: 0 });
      expect(await branchRepository.hasDependents(1)).toBe(false);
    });

    it('is true when the branch has a room', async () => {
      await Branch.create({ id: 1, company_id: 1, owner_id: 1, name: 'A', code: 'A' });
      await Room.create({ id: 1, cinema_id: 1, name: 'R1' });
      expect(await branchRepository.hasDependents(1)).toBe(true);
    });
  });
});
