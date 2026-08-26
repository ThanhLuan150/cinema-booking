const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const MembershipLevel = require('./MembershipLevel');
const Account = require('./Account');

beforeAll(async () => {
  await connect();
  await MembershipLevel.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('MembershipLevel model', () => {
  it('creates a valid level and round-trips fields/defaults', async () => {
    const level = await MembershipLevel.create({ id: 1, code: 'silver', name: 'Silver', min_points: 1000 });
    expect(level.code).toBe('SILVER'); // uppercased
    expect(level.active).toBe(true);
    expect(level.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a code outside Account.MEMBERSHIP_LEVELS', () => {
    const err = new MembershipLevel({ id: 1, code: 'DIAMOND', name: 'Diamond', min_points: 0 }).validateSync();
    expect(err.errors.code).toBeDefined();
  });

  it('accepts every code in Account.MEMBERSHIP_LEVELS', () => {
    for (const code of Account.MEMBERSHIP_LEVELS) {
      const err = new MembershipLevel({ id: 1, code, name: code, min_points: 0 }).validateSync();
      expect(err).toBeUndefined();
    }
  });

  it('enforces unique id and code', async () => {
    await MembershipLevel.create({ id: 1, code: 'SILVER', name: 'Silver', min_points: 1000 });
    await expect(MembershipLevel.create({ id: 1, code: 'GOLD', name: 'Gold', min_points: 5000 })).rejects.toThrow();
    await expect(MembershipLevel.create({ id: 2, code: 'SILVER', name: 'Silver 2', min_points: 2000 })).rejects.toThrow();
  });

  it('fails validation when required fields are missing', () => {
    const err = new MembershipLevel({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.min_points).toBeDefined();
  });

  it('toJSON strips _id and __v', async () => {
    const level = await MembershipLevel.create({ id: 1, code: 'GOLD', name: 'Gold', min_points: 5000 });
    const json = level.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
