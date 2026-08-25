const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const comboOrderRoutes = require('./comboOrder.routes');
const Branch = require('../models/Branch');
const Combo = require('../models/Combo');
const Employee = require('../models/Employee');
const Position = require('../models/Position');

const app = buildTestApp('/api/combo-orders', comboOrderRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const COMBO_STAFF_ACCOUNT_ID = 7;

// Sets up Branch 1 (owned by 42), a Popcorn combo on it, and a COMBO_STAFF employee staffed there.
async function seedComboStaffAtBranch1() {
  await Branch.create({ id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' });
  await Combo.create({ id: 1, cinema_id: 1, name: 'Popcorn Combo', price: 50000, active: true });
  const position = await Position.findOne({ code: 'COMBO_STAFF' });
  await Employee.create({
    id: 1,
    user_id: COMBO_STAFF_ACCOUNT_ID,
    branch_id: 1,
    employee_code: 'E1',
    position_id: position.id,
    status: 1,
  });
}

const orderPayload = () => ({ branch_id: 1, items: [{ combo_id: 1, quantity: 2 }] });

describe('comboOrder.routes wiring', () => {
  it('POST /api/combo-orders requires auth', async () => {
    const res = await request(app).post('/api/combo-orders').send(orderPayload());
    expect(res.status).toBe(401);
  });

  it('POST /api/combo-orders is forbidden for a customer (no combo.sell permission)', async () => {
    await seedComboStaffAtBranch1();
    const res = await request(app)
      .post('/api/combo-orders')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }))
      .send(orderPayload());
    expect(res.status).toBe(403);
  });

  it('POST /api/combo-orders is forbidden for a branch admin (RBAC grants them no combo.sell)', async () => {
    await seedComboStaffAtBranch1();
    const res = await request(app)
      .post('/api/combo-orders')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send(orderPayload());
    expect(res.status).toBe(403);
  });

  it('POST /api/combo-orders forbids a COMBO_STAFF employee staffed at a different branch', async () => {
    await seedComboStaffAtBranch1();
    await Branch.create({ id: 2, company_id: 1, owner_id: 99, name: 'Branch B', code: 'B' });
    const res = await request(app)
      .post('/api/combo-orders')
      .set('Authorization', authHeader({ role: 3, accountId: COMBO_STAFF_ACCOUNT_ID }))
      .send({ branch_id: 2, items: [{ combo_id: 1, quantity: 1 }] });
    expect(res.status).toBe(403);
  });

  it('POST /api/combo-orders allows a COMBO_STAFF employee staffed at that branch', async () => {
    await seedComboStaffAtBranch1();
    const res = await request(app)
      .post('/api/combo-orders')
      .set('Authorization', authHeader({ role: 3, accountId: COMBO_STAFF_ACCOUNT_ID }))
      .send(orderPayload());
    expect(res.status).toBe(201);
    expect(res.body.total_price).toBe(100000);
    expect(res.body.status).toBe('PENDING');
  });

  it('POST /api/combo-orders allows super admin regardless of staffing', async () => {
    await seedComboStaffAtBranch1();
    const res = await request(app)
      .post('/api/combo-orders')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }))
      .send(orderPayload());
    expect(res.status).toBe(201);
  });

  it('GET /api/combo-orders is forbidden for a customer (no combo.order.view permission)', async () => {
    const res = await request(app)
      .get('/api/combo-orders')
      .set('Authorization', authHeader({ role: 1, accountId: 1 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/combo-orders scopes a COMBO_STAFF employee to their own branch', async () => {
    await seedComboStaffAtBranch1();
    await request(app)
      .post('/api/combo-orders')
      .set('Authorization', authHeader({ role: 3, accountId: COMBO_STAFF_ACCOUNT_ID }))
      .send(orderPayload());

    const res = await request(app)
      .get('/api/combo-orders')
      .set('Authorization', authHeader({ role: 3, accountId: COMBO_STAFF_ACCOUNT_ID }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('drives an order through pay -> prepare -> ready -> deliver as COMBO_STAFF', async () => {
    await seedComboStaffAtBranch1();
    const staffAuth = authHeader({ role: 3, accountId: COMBO_STAFF_ACCOUNT_ID });

    const created = await request(app).post('/api/combo-orders').set('Authorization', staffAuth).send(orderPayload());
    const orderId = created.body.id;

    const paid = await request(app)
      .post(`/api/combo-orders/${orderId}/pay`)
      .set('Authorization', staffAuth)
      .send({ method: 'CASH' });
    expect(paid.status).toBe(200);
    expect(paid.body.status).toBe('PAID');

    const preparing = await request(app).post(`/api/combo-orders/${orderId}/prepare`).set('Authorization', staffAuth);
    expect(preparing.status).toBe(200);
    expect(preparing.body.status).toBe('PREPARING');

    const ready = await request(app).post(`/api/combo-orders/${orderId}/ready`).set('Authorization', staffAuth);
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('READY');

    const delivered = await request(app).post(`/api/combo-orders/${orderId}/deliver`).set('Authorization', staffAuth);
    expect(delivered.status).toBe(200);
    expect(delivered.body.status).toBe('DELIVERED');
  });

  it('POST /api/combo-orders/:id/pay is forbidden for a customer (no payment.create permission)', async () => {
    await seedComboStaffAtBranch1();
    const created = await request(app)
      .post('/api/combo-orders')
      .set('Authorization', authHeader({ role: 3, accountId: COMBO_STAFF_ACCOUNT_ID }))
      .send(orderPayload());

    const res = await request(app)
      .post(`/api/combo-orders/${created.body.id}/pay`)
      .set('Authorization', authHeader({ role: 1, accountId: 1 }))
      .send({});
    expect(res.status).toBe(403);
  });

  it('POST /api/combo-orders/:id/cancel cancels a still-pending order', async () => {
    await seedComboStaffAtBranch1();
    const staffAuth = authHeader({ role: 3, accountId: COMBO_STAFF_ACCOUNT_ID });
    const created = await request(app).post('/api/combo-orders').set('Authorization', staffAuth).send(orderPayload());

    const res = await request(app)
      .post(`/api/combo-orders/${created.body.id}/cancel`)
      .set('Authorization', staffAuth)
      .send({ reason: 'customer left' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });
});
