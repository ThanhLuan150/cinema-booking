const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const PricingRule = require('./PricingRule');

beforeAll(async () => {
  await connect();
  await PricingRule.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('PricingRule model', () => {
  it('creates a valid rule and applies defaults (every match dimension wildcarded)', async () => {
    const rule = await PricingRule.create({ id: 1, name: '2D Weekday Standard', price: 80000 });
    expect(rule.priority).toBe(0);
    expect(rule.active).toBe(true);
    expect(rule.effective_from).toBeNull();
    expect(rule.effective_to).toBeNull();
    expect(rule.branch_id).toBeNull();
    expect(rule.room_type).toBeNull();
    expect(rule.seat_type).toBeNull();
    expect(rule.category_id).toBeNull();
    expect(rule.day_type).toBeNull();
    expect(rule.time_start).toBeNull();
    expect(rule.time_end).toBeNull();
    expect(rule.membership_level).toBeNull();
  });

  it('accepts every documented match dimension', async () => {
    const rule = await PricingRule.create({
      id: 1,
      name: 'IMAX VIP Weekend Gold',
      price: 200000,
      priority: 10,
      branch_id: 1,
      room_type: 'IMAX',
      seat_type: 1,
      category_id: 5,
      day_type: 'WEEKEND',
      time_start: '18:00',
      time_end: '23:00',
      membership_level: 'GOLD',
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
    });
    expect(rule.room_type).toBe('IMAX');
    expect(rule.day_type).toBe('WEEKEND');
    expect(rule.membership_level).toBe('GOLD');
  });

  it('fails validation when required fields are missing', () => {
    const err = new PricingRule({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.price).toBeDefined();
  });

  it('rejects an out-of-enum room_type', () => {
    const err = new PricingRule({ id: 1, name: 'x', price: 1, room_type: 'BOGUS' }).validateSync();
    expect(err.errors.room_type).toBeDefined();
  });

  it('rejects an out-of-enum day_type', () => {
    const err = new PricingRule({ id: 1, name: 'x', price: 1, day_type: 'BOGUS' }).validateSync();
    expect(err.errors.day_type).toBeDefined();
  });

  it('rejects an out-of-enum membership_level', () => {
    const err = new PricingRule({ id: 1, name: 'x', price: 1, membership_level: 'BOGUS' }).validateSync();
    expect(err.errors.membership_level).toBeDefined();
  });

  it('enforces unique id', async () => {
    await PricingRule.create({ id: 1, name: 'A', price: 1 });
    await expect(PricingRule.create({ id: 1, name: 'B', price: 2 })).rejects.toThrow();
  });

  it('exposes its enum tables', () => {
    expect(PricingRule.DAY_TYPES).toEqual(['WEEKDAY', 'WEEKEND', 'HOLIDAY']);
    expect(PricingRule.MEMBERSHIP_LEVELS).toEqual(['NONE', 'SILVER', 'GOLD', 'PLATINUM']);
    expect(PricingRule.SEAT_TYPES).toEqual([0, 1, 2]);
  });

  it('toJSON strips _id and __v', async () => {
    const rule = await PricingRule.create({ id: 1, name: 'A', price: 1 });
    const json = rule.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
