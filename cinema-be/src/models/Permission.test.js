const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const Permission = require('./Permission');

beforeAll(async () => {
  await connect();
  await Permission.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Permission model', () => {
  it('creates a valid permission', async () => {
    const permission = await Permission.create({ id: 1, code: 'employee.create', module: 'employee' });
    expect(permission.code).toBe('employee.create');
    expect(permission.description).toBe('');
  });

  it('fails validation when required fields are missing', () => {
    const err = new Permission({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.code).toBeDefined();
    expect(err.errors.module).toBeDefined();
  });

  it('enforces unique code', async () => {
    await Permission.create({ id: 1, code: 'employee.create', module: 'employee' });
    await expect(
      Permission.create({ id: 2, code: 'employee.create', module: 'employee' }),
    ).rejects.toThrow();
  });
});
