const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Role = require('./Role');

beforeAll(async () => {
  await connect();
  await Role.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Role model', () => {
  it('creates a valid role and round-trips fields', async () => {
    const role = await Role.create({ id: 1, code: 'SUPER_ADMIN', legacy_role_number: 0, name: 'Super Admin' });
    expect(role.code).toBe('SUPER_ADMIN');
    expect(role.legacy_role_number).toBe(0);
  });

  it('rejects an unknown code', () => {
    const err = new Role({ id: 1, code: 'NOT_A_ROLE', legacy_role_number: 9, name: 'X' }).validateSync();
    expect(err.errors.code).toBeDefined();
  });

  it('enforces unique code', async () => {
    await Role.create({ id: 1, code: 'SUPER_ADMIN', legacy_role_number: 0, name: 'Super Admin' });
    await expect(
      Role.create({ id: 2, code: 'SUPER_ADMIN', legacy_role_number: 5, name: 'Dup' }),
    ).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const role = await Role.create({ id: 1, code: 'CUSTOMER', legacy_role_number: 1, name: 'Customer' });
    const json = role.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
