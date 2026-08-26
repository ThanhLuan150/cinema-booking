const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const membershipLevelController = require('./membershipLevel.controller');
const MembershipLevel = require('../models/MembershipLevel');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('GET /api/membership-levels (list)', () => {
  it('returns every level sorted ascending by min_points', async () => {
    await MembershipLevel.create([
      { id: 1, code: 'GOLD', name: 'Gold', min_points: 5000 },
      { id: 2, code: 'NONE', name: 'Standard', min_points: 0 },
    ]);
    const res = mockRes();
    await membershipLevelController.list({}, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ code: 'NONE' }), expect.objectContaining({ code: 'GOLD' })]),
    );
    const returned = res.json.mock.calls[0][0];
    expect(returned.map((l) => l.code)).toEqual(['NONE', 'GOLD']);
  });
});

describe('POST /api/membership-levels (create)', () => {
  it('creates a level with a recognized code', async () => {
    const res = mockRes();
    await membershipLevelController.create({ body: { code: 'silver', name: 'Silver', min_points: 1000 } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(await MembershipLevel.countDocuments({ code: 'SILVER' })).toBe(1);
  });

  it('rejects a code outside Account.MEMBERSHIP_LEVELS', async () => {
    const res = mockRes();
    await membershipLevelController.create({ body: { code: 'DIAMOND', name: 'Diamond', min_points: 1000 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a duplicate code', async () => {
    await MembershipLevel.create({ id: 1, code: 'SILVER', name: 'Silver', min_points: 1000 });
    const res = mockRes();
    await membershipLevelController.create({ body: { code: 'SILVER', name: 'Silver 2', min_points: 2000 } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('rejects missing required fields', async () => {
    const res = mockRes();
    await membershipLevelController.create({ body: { code: 'SILVER' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('PUT /api/membership-levels/:id (update)', () => {
  it('updates name/min_points/active but never code', async () => {
    await MembershipLevel.create({ id: 1, code: 'SILVER', name: 'Silver', min_points: 1000 });
    const res = mockRes();
    await membershipLevelController.update(
      { params: { id: '1' }, body: { name: 'Silver Tier', min_points: 1500, active: false } },
      res,
    );
    const updated = await MembershipLevel.findOne({ id: 1 });
    expect(updated.name).toBe('Silver Tier');
    expect(updated.min_points).toBe(1500);
    expect(updated.active).toBe(false);
    expect(updated.code).toBe('SILVER');
  });

  it('404s for a missing level', async () => {
    const res = mockRes();
    await membershipLevelController.update({ params: { id: '999' }, body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('DELETE /api/membership-levels/:id (remove)', () => {
  it('deletes an existing level', async () => {
    await MembershipLevel.create({ id: 1, code: 'SILVER', name: 'Silver', min_points: 1000 });
    const res = mockRes();
    await membershipLevelController.remove({ params: { id: '1' } }, res);
    expect(await MembershipLevel.countDocuments()).toBe(0);
  });

  it('404s for a missing level', async () => {
    const res = mockRes();
    await membershipLevelController.remove({ params: { id: '999' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
