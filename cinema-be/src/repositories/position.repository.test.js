const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const positionRepository = require('./position.repository');
const Position = require('../models/Position');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('position.repository', () => {
  it('findByCode finds a position by its code', async () => {
    await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
    expect((await positionRepository.findByCode('CASHIER')).name).toBe('Cashier');
  });

  it('findByCode returns null for an unknown code', async () => {
    expect(await positionRepository.findByCode('NOPE')).toBeNull();
  });

  it('findById finds a position regardless of status', async () => {
    await Position.create({ id: 1, code: 'SECURITY', name: 'Security', status: 0 });
    expect((await positionRepository.findById(1)).code).toBe('SECURITY');
  });

  describe('findActiveById', () => {
    it('returns an active position', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
      expect((await positionRepository.findActiveById(1)).code).toBe('CASHIER');
    });

    it('returns null for an inactive position', async () => {
      await Position.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 0 });
      expect(await positionRepository.findActiveById(1)).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns every position sorted by id when activeOnly is not set', async () => {
      await Position.create([
        { id: 2, code: 'COMBO_STAFF', name: 'Combo Staff', status: 0 },
        { id: 1, code: 'CASHIER', name: 'Cashier', status: 1 },
      ]);
      const positions = await positionRepository.findAll();
      expect(positions.map((p) => p.id)).toEqual([1, 2]);
    });

    it('only returns active positions when activeOnly is true', async () => {
      await Position.create([
        { id: 1, code: 'CASHIER', name: 'Cashier', status: 1 },
        { id: 2, code: 'COMBO_STAFF', name: 'Combo Staff', status: 0 },
      ]);
      const positions = await positionRepository.findAll({ activeOnly: true });
      expect(positions.map((p) => p.code)).toEqual(['CASHIER']);
    });
  });

  it('create persists a new position', async () => {
    const position = await positionRepository.create({ id: 1, code: 'CASHIER', name: 'Cashier', status: 1 });
    expect(position.code).toBe('CASHIER');
    expect(await Position.countDocuments()).toBe(1);
  });
});
