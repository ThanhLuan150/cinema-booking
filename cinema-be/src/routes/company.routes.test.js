const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const companyRoutes = require('./company.routes');
const Company = require('../models/Company');

const app = buildTestApp('/api/company', companyRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('company.routes wiring — authorization', () => {
  it('GET /api/company requires auth', async () => {
    const res = await request(app).get('/api/company');
    expect(res.status).toBe(401);
  });

  it('GET /api/company forbids a Branch Admin (Super Admin only)', async () => {
    const res = await request(app).get('/api/company').set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/company forbids a Customer', async () => {
    const res = await request(app).get('/api/company').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/company allows Super Admin', async () => {
    const res = await request(app).get('/api/company').set('Authorization', authHeader({ role: 0 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/company forbids a Branch Admin', async () => {
    const res = await request(app)
      .post('/api/company')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ name: 'Acme', code: 'ACME' });
    expect(res.status).toBe(403);
  });

  it('POST /api/company allows Super Admin', async () => {
    const res = await request(app)
      .post('/api/company')
      .set('Authorization', authHeader({ role: 0 }))
      .send({ name: 'Acme', code: 'ACME' });
    expect(res.status).toBe(201);
  });

  it('PUT /api/company/:id forbids a Branch Admin', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    const res = await request(app)
      .put('/api/company/1')
      .set('Authorization', authHeader({ role: 2 }))
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('DELETE /api/company/:id forbids a Branch Admin', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    const res = await request(app).delete('/api/company/1').set('Authorization', authHeader({ role: 2 }));
    expect(res.status).toBe(403);
  });

  it('DELETE /api/company/:id allows Super Admin to delete a company with no branches', async () => {
    await Company.create({ id: 1, name: 'Acme', code: 'ACME' });
    const res = await request(app).delete('/api/company/1').set('Authorization', authHeader({ role: 0 }));
    expect(res.status).toBe(200);
  });
});
