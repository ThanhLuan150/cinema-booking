const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const actorRepository = require('./actor.repository');
const Actor = require('../models/Actor');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('actor.repository', () => {
  it('findAll paginates newest first', async () => {
    await Actor.create([
      { id: 1, full_name: 'A' },
      { id: 2, full_name: 'B' },
    ]);
    const result = await actorRepository.findAll({ skip: 0, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe(2);
  });

  it('findByIds returns matching actors', async () => {
    await Actor.create([{ id: 1, full_name: 'A' }, { id: 2, full_name: 'B' }]);
    const result = await actorRepository.findByIds([1]);
    expect(result).toHaveLength(1);
  });

  it('findById returns null when not found', async () => {
    expect(await actorRepository.findById(999)).toBeNull();
  });

  it('create persists a new actor', async () => {
    const actor = await actorRepository.create({ id: 1, full_name: 'New Actor' });
    expect(actor.full_name).toBe('New Actor');
  });

  it('updateFields updates and returns the new document', async () => {
    await Actor.create({ id: 1, full_name: 'Old' });
    const updated = await actorRepository.updateFields(1, { full_name: 'New' });
    expect(updated.full_name).toBe('New');
  });

  it('remove deletes the actor', async () => {
    await Actor.create({ id: 1, full_name: 'A' });
    await actorRepository.remove(1);
    expect(await Actor.countDocuments()).toBe(0);
  });
});
