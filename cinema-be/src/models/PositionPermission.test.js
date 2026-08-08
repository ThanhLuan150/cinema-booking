const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const PositionPermission = require('./PositionPermission');

beforeAll(async () => {
  await connect();
  await PositionPermission.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('PositionPermission model', () => {
  it('creates a valid link with a default BRANCH scope', async () => {
    const link = await PositionPermission.create({ id: 1, position_id: 1, permission_id: 1 });
    expect(link.scope).toBe('BRANCH');
  });

  it('fails validation when required fields are missing', () => {
    const err = new PositionPermission({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.position_id).toBeDefined();
    expect(err.errors.permission_id).toBeDefined();
  });

  it('enforces unique (position_id, permission_id)', async () => {
    await PositionPermission.create({ id: 1, position_id: 1, permission_id: 1 });
    await expect(PositionPermission.create({ id: 2, position_id: 1, permission_id: 1 })).rejects.toThrow();
  });

  it('allows the same permission_id for a different position_id', async () => {
    await PositionPermission.create({ id: 1, position_id: 1, permission_id: 1 });
    await expect(PositionPermission.create({ id: 2, position_id: 2, permission_id: 1 })).resolves.toBeDefined();
  });
});
