const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { authHeader } = require('../../tests/routeTestUtils');
const { errorHandler } = require('../middleware/errorHandler');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const supplierRoutes = require('./supplier.routes');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const Position = require('../models/Position');
const Employee = require('../models/Employee');
const AuditLog = require('../models/AuditLog');

jest.mock('../utils/socket', () => ({
  emitBranchEvent: jest.fn(),
  emitToAccount: jest.fn(),
  emitToAdmin: jest.fn(),
  emitToBranch: jest.fn(),
  emitToStaff: jest.fn(),
}));

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/suppliers', supplierRoutes);
app.use(errorHandler);

beforeAll(async () => {
  await connect();
  await Supplier.init();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const SUPER = authHeader({ role: 0, accountId: 1 });
const BRANCH_ADMIN = authHeader({ role: 2, accountId: 42 });
const CUSTOMER = authHeader({ role: 1, accountId: 900 });
const STAFF = authHeader({ role: 3, accountId: 7 });

const valid = { name: 'Acme Foods', code: 'acme', email: 'sales@acme.test', phone: '+84 28 3822 1234', address: '1 Nguyen Hue, HCMC' };
const create = (body = valid, auth = SUPER) => request(app).post('/api/suppliers').set('Authorization', auth).send(body);

describe('supplier management (Super Admin)', () => {
  it('creates a supplier, upper-casing the code, and audits it', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Acme Foods', code: 'ACME', email: 'sales@acme.test', address: '1 Nguyen Hue, HCMC', status: 'ACTIVE' });
    expect(await AuditLog.countDocuments({ action: 'SUPPLIER_CREATED', entity_id: res.body.id })).toBe(1);
  });

  it.each([
    ['a missing name', { code: 'X1' }],
    ['a bad code', { name: 'A', code: '!!' }],
    ['a bad email', { name: 'A', code: 'AA', email: 'nope' }],
    ['a bad phone', { name: 'A', code: 'AA', phone: 'call me' }],
    ['a bad status', { name: 'A', code: 'AA', status: 'MAYBE' }],
  ])('rejects %s', async (_label, body) => {
    const res = await create(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a duplicate code (case-insensitively)', async () => {
    await create();
    const dup = await create({ ...valid, name: 'Other', code: 'Acme' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('SUPPLIER_CODE_TAKEN');
  });

  it('updates fields, and cannot rename onto another supplier code', async () => {
    const a = await create();
    const b = await create({ name: 'Beta', code: 'BETA' });
    const ok = await request(app).put(`/api/suppliers/${a.body.id}`).set('Authorization', SUPER).send({ phone: '0901234567', status: 'INACTIVE' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ phone: '0901234567', status: 'INACTIVE' });
    const clash = await request(app).put(`/api/suppliers/${b.body.id}`).set('Authorization', SUPER).send({ code: 'acme' });
    expect(clash.status).toBe(409);
  });

  it('lists with search/status filters and a picker endpoint', async () => {
    await create();
    await create({ name: 'Beta', code: 'BETA', status: 'INACTIVE' });
    const search = await request(app).get('/api/suppliers?search=bet').set('Authorization', SUPER);
    expect(search.body.data.map((s) => s.code)).toEqual(['BETA']);
    const active = await request(app).get('/api/suppliers/all?status=ACTIVE').set('Authorization', SUPER);
    expect(active.body.map((s) => s.code)).toEqual(['ACME']);
  });

  it('cannot delete a supplier that has purchase orders, but can delete an unused one', async () => {
    const used = await create();
    const unused = await create({ name: 'Beta', code: 'BETA' });
    await PurchaseOrder.create({
      id: 1, code: 'PO-000001', supplier_id: used.body.id, branch_id: 1, order_date: new Date(), status: 'DRAFT', total_amount: 0,
    });
    const blocked = await request(app).delete(`/api/suppliers/${used.body.id}`).set('Authorization', SUPER);
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('SUPPLIER_IN_USE');
    const ok = await request(app).delete(`/api/suppliers/${unused.body.id}`).set('Authorization', SUPER);
    expect(ok.status).toBe(200);
    expect(await Supplier.countDocuments({ id: unused.body.id })).toBe(0);
  });

  it('answers 404 for an unknown supplier', async () => {
    expect((await request(app).get('/api/suppliers/999').set('Authorization', SUPER)).status).toBe(404);
    expect((await request(app).put('/api/suppliers/999').set('Authorization', SUPER).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).delete('/api/suppliers/999').set('Authorization', SUPER)).status).toBe(404);
  });
});

describe('supplier authorization', () => {
  it('a Branch Admin can read the catalogue but not change it', async () => {
    const made = await create();
    expect((await request(app).get('/api/suppliers').set('Authorization', BRANCH_ADMIN)).status).toBe(200);
    expect((await request(app).get(`/api/suppliers/${made.body.id}`).set('Authorization', BRANCH_ADMIN)).status).toBe(200);
    expect((await create({ name: 'X', code: 'XX' }, BRANCH_ADMIN)).status).toBe(403);
    expect((await request(app).put(`/api/suppliers/${made.body.id}`).set('Authorization', BRANCH_ADMIN).send({ name: 'Hax' })).status).toBe(403);
    expect((await request(app).delete(`/api/suppliers/${made.body.id}`).set('Authorization', BRANCH_ADMIN)).status).toBe(403);
    expect((await Supplier.findOne({ id: made.body.id })).name).toBe('Acme Foods');
  });

  it('customers, ordinary Employees and anonymous callers get nothing', async () => {
    const position = await Position.findOne({ code: 'CONCESSION_STAFF' });
    await Employee.create({ id: 1, user_id: 7, branch_id: 1, employee_code: 'E1', position_id: position.id, status: 1 });
    expect((await request(app).get('/api/suppliers')).status).toBe(401);
    for (const auth of [CUSTOMER, STAFF]) {
      expect((await request(app).get('/api/suppliers').set('Authorization', auth)).status).toBe(403);
      expect((await create(valid, auth)).status).toBe(403);
    }
  });
});
