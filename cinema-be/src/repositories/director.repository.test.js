const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const directorRepository = require('./director.repository');
const Director = require('../models/Director');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('director.repository', () => {
  it('findAll paginates newest first', async () => {
    await Director.create([
      { id: 1, full_name: 'A' },
      { id: 2, full_name: 'B' },
    ]);
    const result = await directorRepository.findAll({ skip: 0, limit: 20 });
    expect(result.total).toBe(2);
    expect(result.data[0].id).toBe(2);
  });

  it('findByIds returns matching directors', async () => {
    await Director.create([{ id: 1, full_name: 'A' }, { id: 2, full_name: 'B' }]);
    const result = await directorRepository.findByIds([1]);
    expect(result).toHaveLength(1);
  });

  it('findById returns null when not found', async () => {
    expect(await directorRepository.findById(999)).toBeNull();
  });

  it('create persists a new director', async () => {
    const director = await directorRepository.create({ id: 1, full_name: 'New Director' });
    expect(director.full_name).toBe('New Director');
  });

  it('updateFields updates and returns the new document', async () => {
    await Director.create({ id: 1, full_name: 'Old' });
    const updated = await directorRepository.updateFields(1, { full_name: 'New' });
    expect(updated.full_name).toBe('New');
  });

  it('remove deletes the director', async () => {
    await Director.create({ id: 1, full_name: 'A' });
    await directorRepository.remove(1);
    expect(await Director.countDocuments()).toBe(0);
  });
});
