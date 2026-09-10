const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const parkingRoutes = require('./parking.routes');
const Branch = require('../models/Branch');
const ParkingArea = require('../models/ParkingArea');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingTicket = require('../models/ParkingTicket');

const app = buildTestApp('/api/parking', parkingRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42;
const OWNER_B = 99;
const adminAuth = () => authHeader({ role: 0, accountId: 1 });
const ownerAAuth = () => authHeader({ role: 2, accountId: OWNER_A });
const ownerBAuth = () => authHeader({ role: 2, accountId: OWNER_B });

async function seedBranches() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
}

async function seedAreaWithSlot({ areaId = 1, branchId = 1, slotId = 1, slotStatus = 'AVAILABLE' } = {}) {
  await ParkingArea.create({ id: areaId, branch_id: branchId, name: `Lot ${areaId}`, capacity: 10, status: 'ACTIVE' });
  await ParkingSlot.create({
    id: slotId,
    parking_area_id: areaId,
    slot_code: `S-${slotId}`,
    vehicle_type: 'CAR',
    status: slotStatus,
  });
}

describe('parking.routes — wiring & RBAC', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/parking/areas?branchId=1');
    expect(res.status).toBe(401);
  });

  it('is forbidden for a customer', async () => {
    await seedBranches();
    const res = await request(app).get('/api/parking/areas?branchId=1').set('Authorization', authHeader({ role: 1, accountId: 7 }));
    expect(res.status).toBe(403);
  });

  it('requires branchId for a branch-scoped caller listing without one', async () => {
    await seedBranches();
    const res = await request(app).get('/api/parking/areas').set('Authorization', ownerAAuth());
    expect(res.status).toBe(400);
  });

  it('lets the owning branch admin create an area and a slot, then list them', async () => {
    await seedBranches();
    const areaRes = await request(app)
      .post('/api/parking/areas')
      .set('Authorization', ownerAAuth())
      .send({ branch_id: 1, name: 'Basement', capacity: 40 });
    expect(areaRes.status).toBe(201);

    const slotRes = await request(app)
      .post('/api/parking/slots')
      .set('Authorization', ownerAAuth())
      .send({ parking_area_id: areaRes.body.id, slot_code: 'B1-001', vehicle_type: 'CAR' });
    expect(slotRes.status).toBe(201);

    const list = await request(app).get('/api/parking/slots?areaId=' + areaRes.body.id).set('Authorization', ownerAAuth());
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
  });

  it("forbids a branch admin from touching another branch's parking area", async () => {
    await seedBranches();
    await seedAreaWithSlot({ areaId: 1, branchId: 1 });
    const res = await request(app)
      .put('/api/parking/areas/1')
      .set('Authorization', ownerBAuth())
      .send({ name: 'hijacked' });
    expect(res.status).toBe(403);
  });

  it("forbids admitting a vehicle onto another branch's slot via branch_id scope", async () => {
    await seedBranches();
    await seedAreaWithSlot({ areaId: 1, branchId: 1, slotId: 1 });
    // OWNER_B cannot pass branch_id: 1
    const res = await request(app)
      .post('/api/parking/tickets')
      .set('Authorization', ownerBAuth())
      .send({ branch_id: 1, vehicle_type: 'CAR', vehicle_plate: 'ABC' });
    expect(res.status).toBe(403);
  });
});

describe('parking.routes — vehicle flow over HTTP', () => {
  it('enter -> exit -> payment', async () => {
    await seedBranches();
    await seedAreaWithSlot();

    const enter = await request(app)
      .post('/api/parking/tickets')
      .set('Authorization', ownerAAuth())
      .send({ branch_id: 1, vehicle_type: 'CAR', vehicle_plate: '51f-999.99', slot_id: 1 });
    expect(enter.status).toBe(201);
    const id = enter.body.id;
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('OCCUPIED');

    await ParkingTicket.updateOne({ id }, { entry_at: new Date(Date.now() - 90 * 60 * 1000) });

    const exit = await request(app).post(`/api/parking/tickets/${id}/exit`).set('Authorization', ownerAAuth());
    expect(exit.status).toBe(200);
    expect(exit.body.status).toBe('PENDING_PAYMENT');
    expect(exit.body.fee).toBeGreaterThan(0);

    const pay = await request(app).post(`/api/parking/tickets/${id}/payment`).set('Authorization', ownerAAuth());
    expect(pay.status).toBe(200);
    expect(pay.body.status).toBe('COMPLETED');
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('AVAILABLE');
  });

  it('a slot cannot be assigned to two vehicles at once (two concurrent HTTP entries)', async () => {
    await seedBranches();
    await seedAreaWithSlot();

    const fire = () =>
      request(app)
        .post('/api/parking/tickets')
        .set('Authorization', ownerAAuth())
        .send({ branch_id: 1, vehicle_type: 'CAR', vehicle_plate: 'RACE', slot_id: 1 });

    const [a, b] = await Promise.all([fire(), fire()]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);

    const tickets = await ParkingTicket.find({ slot_id: 1, status: 'ACTIVE' });
    expect(tickets).toHaveLength(1);
    expect((await ParkingSlot.findOne({ id: 1 })).status).toBe('OCCUPIED');
  });

  it('N concurrent auto-assign entries never overfill a single-slot branch', async () => {
    await seedBranches();
    await seedAreaWithSlot();

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        request(app)
          .post('/api/parking/tickets')
          .set('Authorization', ownerAAuth())
          .send({ branch_id: 1, vehicle_type: 'CAR', vehicle_plate: `P${i}` }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(5);
    expect(await ParkingTicket.countDocuments({ status: 'ACTIVE' })).toBe(1);
  });

  it('N concurrent auto-assign entries spread across a multi-slot branch, one vehicle per slot', async () => {
    await seedBranches();
    await ParkingArea.create({ id: 1, branch_id: 1, name: 'Lot 1', capacity: 10, status: 'ACTIVE' });
    await ParkingSlot.create(
      Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        parking_area_id: 1,
        slot_code: `S-${i + 1}`,
        vehicle_type: 'CAR',
        status: 'AVAILABLE',
      })),
    );

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/parking/tickets')
          .set('Authorization', ownerAAuth())
          .send({ branch_id: 1, vehicle_type: 'CAR', vehicle_plate: `P${i}` }),
      ),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    const usedSlots = results.map((r) => r.body.slot_id).sort();
    expect(new Set(usedSlots).size).toBe(5); // no slot handed out twice
    expect(await ParkingSlot.countDocuments({ status: 'AVAILABLE' })).toBe(0);
    expect(await ParkingSlot.countDocuments({ status: 'OCCUPIED' })).toBe(5);
  });

  it('super admin may list every branch without a branchId', async () => {
    await seedBranches();
    await seedAreaWithSlot({ areaId: 1, branchId: 1 });
    await seedAreaWithSlot({ areaId: 2, branchId: 2, slotId: 2 });
    const res = await request(app).get('/api/parking/areas').set('Authorization', adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
  });
});
