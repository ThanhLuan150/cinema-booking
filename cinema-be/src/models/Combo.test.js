const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Combo = require('./Combo');

beforeAll(async () => {
  await connect();
  await Combo.init(); // ensure unique indexes are built before tests rely on them
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Combo model', () => {
  it('creates a valid combo and applies defaults', async () => {
    const combo = await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn', price: 50000 });
    expect(combo.description).toBe('');
    expect(combo.image).toBe('');
    expect(combo.active).toBe(true);
    expect(combo.type).toBe('COMBO');
    expect(combo.items).toEqual([]);
    expect(combo.createdAt).toBeInstanceOf(Date);
  });

  it('rejects a type outside FOOD/BEVERAGE/COMBO', () => {
    const err = new Combo({ id: 1, cinema_id: 1, name: 'A', price: 1, type: 'BOGUS' }).validateSync();
    expect(err.errors.type).toBeDefined();
  });

  it('stores a COMBO type with its component items', async () => {
    const combo = await Combo.create({
      id: 1,
      cinema_id: 1,
      name: 'Combo Bắp Nước',
      price: 65000,
      type: 'COMBO',
      items: [
        { item_id: 2, quantity: 1 },
        { item_id: 3, quantity: 2 },
      ],
    });
    expect(combo.items).toHaveLength(2);
    expect(combo.items[0].item_id).toBe(2);
    expect(combo.items[1].quantity).toBe(2);
  });

  it('creates FOOD and BEVERAGE items', async () => {
    const food = await Combo.create({ id: 2, cinema_id: 1, name: 'Popcorn', price: 30000, type: 'FOOD' });
    const beverage = await Combo.create({ id: 3, cinema_id: 1, name: 'Coke', price: 20000, type: 'BEVERAGE' });
    expect(food.type).toBe('FOOD');
    expect(beverage.type).toBe('BEVERAGE');
  });

  it('exposes the TYPE constant', () => {
    expect(Combo.TYPE).toEqual({ FOOD: 'FOOD', BEVERAGE: 'BEVERAGE', COMBO: 'COMBO' });
  });

  it('fails validation when required fields are missing', () => {
    const err = new Combo({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.cinema_id).toBeDefined();
    expect(err.errors.name).toBeDefined();
    expect(err.errors.price).toBeDefined();
  });

  it('enforces unique id', async () => {
    await Combo.create({ id: 1, cinema_id: 1, name: 'A', price: 1 });
    await expect(Combo.create({ id: 1, cinema_id: 1, name: 'B', price: 2 })).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const combo = await Combo.create({ id: 1, cinema_id: 1, name: 'A', price: 1 });
    const json = combo.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
