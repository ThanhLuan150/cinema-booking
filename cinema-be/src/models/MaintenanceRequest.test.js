const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const MaintenanceRequest = require('./MaintenanceRequest');

beforeAll(async () => {
  await connect();
  await MaintenanceRequest.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    branch_id: 1,
    resource_type: 'ROOM',
    room_id: 1,
    title: 'Projector flickers',
    reported_by: 7,
    ...overrides,
  };
}

describe('MaintenanceRequest model', () => {
  it('creates a valid request and defaults status to OPEN', async () => {
    const request = await MaintenanceRequest.create(baseFields());
    expect(request.status).toBe('OPEN');
    expect(request.description).toBe('');
    expect(request.assigned_employee_id).toBeNull();
    expect(request.createdAt).toBeInstanceOf(Date);
  });

  it('fails validation when required fields are missing', () => {
    const err = new MaintenanceRequest({}).validateSync();
    expect(err.errors.id).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.resource_type).toBeDefined();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.reported_by).toBeDefined();
  });

  it('rejects an invalid resource_type', () => {
    const err = new MaintenanceRequest(baseFields({ resource_type: 'FRIDGE' })).validateSync();
    expect(err.errors.resource_type).toBeDefined();
  });

  it('rejects an invalid status', () => {
    const err = new MaintenanceRequest(baseFields({ status: 'DONE' })).validateSync();
    expect(err.errors.status).toBeDefined();
  });

  it('accepts every documented resource_type', () => {
    for (const type of MaintenanceRequest.RESOURCE_TYPES) {
      const err = new MaintenanceRequest(baseFields({ resource_type: type, room_id: null })).validateSync();
      expect(err).toBeUndefined();
    }
  });

  it('accepts every documented status', () => {
    for (const status of MaintenanceRequest.STATUSES) {
      const err = new MaintenanceRequest(baseFields({ status })).validateSync();
      expect(err).toBeUndefined();
    }
  });

  it('enforces unique id', async () => {
    await MaintenanceRequest.create(baseFields());
    await expect(MaintenanceRequest.create(baseFields({ room_id: 2 }))).rejects.toThrow();
  });

  it('toJSON strips _id and __v', async () => {
    const request = await MaintenanceRequest.create(baseFields());
    const json = request.toJSON();
    expect(json._id).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});
