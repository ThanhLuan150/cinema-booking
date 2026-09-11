const crypto = require('crypto');
const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const webhookRoutes = require('./webhook.routes');
const Integration = require('../models/Integration');
const Webhook = require('../models/Webhook');

const app = buildTestApp('/api/webhooks', webhookRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => {
  await clearDatabase();
  delete process.env.TESTHOOK_SECRET;
});
afterAll(async () => closeDatabase());

const superAdmin = () => authHeader({ role: 0, accountId: 1 });
const branchAdmin = () => authHeader({ role: 2, accountId: 42 });

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
}

describe('POST /api/webhooks/:provider (public receiver)', () => {
  it('404s for an unregistered provider', async () => {
    const res = await request(app).post('/api/webhooks/unknown').send({ event: 'x' });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INTEGRATION_NOT_FOUND');
  });

  it('404s for a registered but INACTIVE integration', async () => {
    await Integration.create({ id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING', status: 'INACTIVE' });
    const res = await request(app).post('/api/webhooks/testhook').send({ event: 'x' });
    expect(res.status).toBe(404);
  });

  it('rejects a missing signature when the integration has a secret configured', async () => {
    process.env.TESTHOOK_SECRET = 'shh';
    await Integration.create({
      id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING', secret_env_var: 'TESTHOOK_SECRET',
    });
    const res = await request(app).post('/api/webhooks/testhook').send({ event: 'ticket.issued', id: 'evt-1' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect(await Webhook.countDocuments()).toBe(0);
  });

  it('rejects a tampered signature', async () => {
    process.env.TESTHOOK_SECRET = 'shh';
    await Integration.create({
      id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING', secret_env_var: 'TESTHOOK_SECRET',
    });
    const res = await request(app)
      .post('/api/webhooks/testhook')
      .set('x-webhook-signature', sign({ event: 'other' }, 'shh'))
      .send({ event: 'ticket.issued', id: 'evt-1' });
    expect(res.status).toBe(401);
  });

  it('accepts a correctly signed event and processes it', async () => {
    process.env.TESTHOOK_SECRET = 'shh';
    await Integration.create({
      id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING', secret_env_var: 'TESTHOOK_SECRET',
    });
    const body = { event: 'ticket.issued', id: 'evt-1' };
    const res = await request(app)
      .post('/api/webhooks/testhook')
      .set('x-webhook-signature', sign(body, 'shh'))
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true, duplicate: false, status: 'SUCCESS' });

    const row = await Webhook.findOne({ provider: 'TESTHOOK' });
    expect(row.signature_verified).toBe(true);
    expect(row.status).toBe('SUCCESS');
  });

  it('accepts unsigned traffic when no secret is configured for the integration', async () => {
    await Integration.create({ id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING' });
    const res = await request(app).post('/api/webhooks/testhook').send({ event: 'ticket.issued', id: 'evt-1' });
    expect(res.status).toBe(200);
    const row = await Webhook.findOne({ provider: 'TESTHOOK' });
    expect(row.signature_verified).toBe(false);
  });

  it('does not process a duplicate event: a repeated delivery of the same id is not reprocessed', async () => {
    await Integration.create({ id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING' });
    const body = { event: 'ticket.issued', id: 'evt-idem' };

    const first = await request(app).post('/api/webhooks/testhook').send(body);
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBe(false);

    const second = await request(app).post('/api/webhooks/testhook').send(body);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    expect(await Webhook.countDocuments({ provider: 'TESTHOOK' })).toBe(1);
  });

  it('two concurrent deliveries of the same event dedupe to a single processed row', async () => {
    await Integration.create({ id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING' });
    const body = { event: 'ticket.issued', id: 'evt-race' };

    const [a, b] = await Promise.all([
      request(app).post('/api/webhooks/testhook').send(body),
      request(app).post('/api/webhooks/testhook').send(body),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await Webhook.countDocuments({ provider: 'TESTHOOK' })).toBe(1);
  });

  it('redacts obviously sensitive fields before persisting the payload', async () => {
    await Integration.create({ id: 1, name: 'Test Hook', provider: 'TESTHOOK', type: 'THIRD_PARTY_TICKETING' });
    await request(app)
      .post('/api/webhooks/testhook')
      .send({ event: 'ticket.issued', id: 'evt-1', apiKey: 'sk_live_should_not_be_stored' });
    const row = await Webhook.findOne({ provider: 'TESTHOOK' });
    expect(row.payload.apiKey).toBe('[REDACTED]');
  });
});

describe('admin webhook log', () => {
  it('GET / requires integration.read (super admin only)', async () => {
    const forbidden = await request(app).get('/api/webhooks').set('Authorization', branchAdmin());
    expect(forbidden.status).toBe(403);

    await Webhook.create({ id: 1, provider: 'MOMO', event: 'payment.success', status: 'SUCCESS' });
    const res = await request(app).get('/api/webhooks').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  it('GET /:id returns a single webhook', async () => {
    await Webhook.create({ id: 1, provider: 'MOMO', event: 'payment.success', status: 'SUCCESS' });
    const res = await request(app).get('/api/webhooks/1').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe('MOMO');
  });

  it('POST /:id/retry replays a FAILED webhook and requires integration.manage', async () => {
    await Webhook.create({
      id: 1, provider: 'MOMO', event: 'payment.success', status: 'FAILED', attempts: 1, last_error: 'boom',
      next_attempt_at: new Date(),
    });

    const forbidden = await request(app).post('/api/webhooks/1/retry').set('Authorization', branchAdmin());
    expect(forbidden.status).toBe(403);

    const res = await request(app).post('/api/webhooks/1/retry').set('Authorization', superAdmin());
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS'); // default processor (none registered for MOMO here) just acknowledges
  });

  it('POST /:id/retry rejects a webhook that is not FAILED', async () => {
    await Webhook.create({ id: 1, provider: 'MOMO', event: 'payment.success', status: 'SUCCESS' });
    const res = await request(app).post('/api/webhooks/1/retry').set('Authorization', superAdmin());
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEBHOOK_NOT_RETRYABLE');
  });
});
