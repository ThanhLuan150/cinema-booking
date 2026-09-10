const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const ParkingTicket = require('./ParkingTicket');

beforeAll(async () => {
  await connect();
  await ParkingTicket.init();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

function baseFields(overrides = {}) {
  return {
    id: 1,
    ticket_code: 'PK-ABC123',
    branch_id: 1,
    slot_id: 1,
    vehicle_type: 'CAR',
    vehicle_plate: '51f-123.45',
    ...overrides,
  };
}

describe('ParkingTicket model', () => {
  it('creates a valid ticket, defaults status ACTIVE / fee 0 / entry_at now', async () => {
    const ticket = await ParkingTicket.create(baseFields());
    expect(ticket.status).toBe('ACTIVE');
    expect(ticket.fee).toBe(0);
    expect(ticket.entry_at).toBeInstanceOf(Date);
    expect(ticket.exit_at).toBeNull();
  });

  it('uppercases ticket_code and vehicle_plate', async () => {
    const ticket = await ParkingTicket.create(baseFields({ ticket_code: 'pk-lower1', vehicle_plate: '51f-123.45' }));
    expect(ticket.ticket_code).toBe('PK-LOWER1');
    expect(ticket.vehicle_plate).toBe('51F-123.45');
  });

  it('fails validation when required fields are missing', () => {
    const err = new ParkingTicket({}).validateSync();
    expect(err.errors.ticket_code).toBeDefined();
    expect(err.errors.branch_id).toBeDefined();
    expect(err.errors.slot_id).toBeDefined();
    expect(err.errors.vehicle_type).toBeDefined();
    expect(err.errors.vehicle_plate).toBeDefined();
  });

  it('rejects an invalid status and a negative fee', () => {
    expect(new ParkingTicket(baseFields({ status: 'PARKED' })).validateSync().errors.status).toBeDefined();
    expect(new ParkingTicket(baseFields({ fee: -5 })).validateSync().errors.fee).toBeDefined();
  });

  it('enforces unique ticket_code', async () => {
    await ParkingTicket.create(baseFields());
    await expect(ParkingTicket.create(baseFields({ id: 2 }))).rejects.toThrow();
  });
});
