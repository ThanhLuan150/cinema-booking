const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Promotion = require('./Promotion');

beforeAll(async () => {
  await connect();
  await Promotion.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    code: 'summer10',
    name: 'Summer Sale',
    discount_type: 'PERCENTAGE',
    discount_value: 10,
    start_at: new Date('2026-01-01'),
    end_at: new Date('2026-02-01'),
    ...overrides,
  };
}

describe('Promotion model', () => {
  it('creates a valid promotion and applies defaults', async () => {
    const promotion = await Promotion.create(baseFields());
    expect(promotion.code).toBe('SUMMER10'); // uppercased
    expect(promotion.description).toBe('');
    expect(promotion.minimum_order_value).toBe(0);
    expect(promotion.maximum_discount).toBeNull();
    expect(promotion.usage_limit).toBeNull();
    expect(promotion.used_count).toBe(0);
    expect(promotion.per_customer_limit).toBeNull();
    expect(promotion.status).toBe('ACTIVE');
    expect(promotion.branch_ids).toEqual([]);
    expect(promotion.movie_ids).toEqual([]);
    expect(promotion.showtime_ids).toEqual([]);
    expect(promotion.combo_ids).toEqual([]);
    expect(promotion.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new Promotion({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.discount_type).toBeDefined();
    expect(err.errors.discount_value).toBeDefined();
    expect(err.errors.start_at).toBeDefined();
    expect(err.errors.end_at).toBeDefined();
  });

  it('rejects a discount_type outside the enum', () => {
    const promotion = new Promotion(baseFields({ discount_type: 'invalid' }));
    const err = promotion.validateSync();
    expect(err.errors.discount_type).toBeDefined();
  });

  it('rejects a status outside the enum', () => {
    const promotion = new Promotion(baseFields({ status: 'invalid' }));
    const err = promotion.validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('enforces unique id and code', async () => {
    await Promotion.create(baseFields({ id: 1, code: 'A' }));
    await expect(Promotion.create(baseFields({ id: 1, code: 'B' }))).rejects.toThrow();
    await expect(Promotion.create(baseFields({ id: 2, code: 'A' }))).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const promotion = await Promotion.create(baseFields());
    const json = promotion.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
