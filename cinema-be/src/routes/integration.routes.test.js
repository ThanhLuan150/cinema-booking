const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const integrationRoutes = require('./integration.routes');
const Integration = require('../models/Integration');

const app = buildTestApp('/api/integrations', integrationRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const superAdmin = () => authHeader({ role: 0, accountId: 1 });
const branchAdmin = () => authHeader({ role: 2, accountId: 42 });
const customer = () => authHeader({ role: 1, accountId: 7 });

describe('integration.routes', () => {
  it('GET / requires auth', async () => {
    const res = await request(app).get('/api/integrations');
    expect(res.status).toBe(401);
  });

  it('GET / forbids a branch admin (integration.read is SUPER_ADMIN only)', async () => {
    const res = await request(app).get('/api/integrations').set('Authorization', branchAdmin());
    expect(res.status).toBe(403);
  });

  it('GET / forbids a customer', async () => {
    const res = await request(app).get('/api/integrations').set('Authorization', customer());
    expect(res.status).toBe(403);
  });

  it('GET / allows a super admin and paginates', async () => {
    await Integration.create({ id: 1, name: 'MoMo Wallet', provider: 'MOMO', type: 'PAYMENT_GATEWAY' });
    const res = await request(app).get('/api/integrations').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });

  it('POST / creates an integration, uppercasing the provider', async () => {
    const res = await request(app)
      .post('/api/integrations')
      .set('Authorization', superAdmin())
      .send({ name: 'SendGrid', provider: 'sendgrid', type: 'EMAIL_PROVIDER', secret_env_var: 'SENDGRID_SECRET' });
    expect(res.status).toBe(201);
    expect(res.body.provider).toBe('SENDGRID');
    expect(res.body.status).toBe('ACTIVE');
  });

  it('POST / never echoes back a secret value, only the env var name', async () => {
    const res = await request(app)
      .post('/api/integrations')
      .set('Authorization', superAdmin())
      .send({ name: 'SendGrid', provider: 'SENDGRID', type: 'EMAIL_PROVIDER', secret_env_var: 'SENDGRID_SECRET' });
    expect(res.body.secret_env_var).toBe('SENDGRID_SECRET');
    expect(JSON.stringify(res.body)).not.toMatch(/sk_|secret_value/i);
  });

  it('POST / rejects an unknown type', async () => {
    const res = await request(app)
      .post('/api/integrations')
      .set('Authorization', superAdmin())
      .send({ name: 'X', provider: 'X', type: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('POST / rejects a duplicate provider', async () => {
    await Integration.create({ id: 1, name: 'MoMo Wallet', provider: 'MOMO', type: 'PAYMENT_GATEWAY' });
    const res = await request(app)
      .post('/api/integrations')
      .set('Authorization', superAdmin())
      .send({ name: 'MoMo Again', provider: 'momo', type: 'PAYMENT_GATEWAY' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PROVIDER_TAKEN');
  });

  it('PUT /:id updates fields and forbids a non-super-admin', async () => {
    await Integration.create({ id: 1, name: 'MoMo Wallet', provider: 'MOMO', type: 'PAYMENT_GATEWAY' });
    const forbidden = await request(app)
      .put('/api/integrations/1')
      .set('Authorization', branchAdmin())
      .send({ status: 'INACTIVE' });
    expect(forbidden.status).toBe(403);

    const res = await request(app)
      .put('/api/integrations/1')
      .set('Authorization', superAdmin())
      .send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INACTIVE');
  });

  it('DELETE /:id removes the integration', async () => {
    await Integration.create({ id: 1, name: 'MoMo Wallet', provider: 'MOMO', type: 'PAYMENT_GATEWAY' });
    const res = await request(app).delete('/api/integrations/1').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(await Integration.findOne({ id: 1 })).toBeNull();
  });

  it('GET /:id 404s for an unknown id', async () => {
    const res = await request(app).get('/api/integrations/999').set('Authorization', superAdmin());
    expect(res.status).toBe(404);
  });
});
