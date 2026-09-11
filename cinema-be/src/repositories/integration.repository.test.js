const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Integration = require('../models/Integration');
const integrationRepository = require('./integration.repository');

beforeAll(async () => {
  await connect();
  await Integration.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return { id: 1, name: 'MoMo Wallet', provider: 'MOMO', type: 'PAYMENT_GATEWAY', ...overrides };
}

describe('integration.repository', () => {
  it('creates and finds by id', async () => {
    await integrationRepository.create(baseFields());
    const found = await integrationRepository.findById(1);
    expect(found.name).toBe('MoMo Wallet');
  });

  it('findByProvider is case-insensitive by convention (uppercases the lookup)', async () => {
    await integrationRepository.create(baseFields());
    expect(await integrationRepository.findByProvider('momo')).not.toBeNull();
    expect(await integrationRepository.findByProvider('unknown')).toBeNull();
  });

  it('findFiltered paginates and filters by type/status', async () => {
    await integrationRepository.create(baseFields({ id: 1 }));
    await integrationRepository.create(baseFields({ id: 2, provider: 'SENDGRID', type: 'EMAIL_PROVIDER', status: 'INACTIVE' }));
    const { data, total } = await integrationRepository.findFiltered({ type: 'PAYMENT_GATEWAY' }, { skip: 0, limit: 20 });
    expect(total).toBe(1);
    expect(data[0].id).toBe(1);
  });

  it('updateFields applies a partial update', async () => {
    await integrationRepository.create(baseFields());
    const updated = await integrationRepository.updateFields(1, { status: 'INACTIVE' });
    expect(updated.status).toBe('INACTIVE');
  });

  it('remove deletes the row', async () => {
    await integrationRepository.create(baseFields());
    await integrationRepository.remove(1);
    expect(await integrationRepository.findById(1)).toBeNull();
  });
});
