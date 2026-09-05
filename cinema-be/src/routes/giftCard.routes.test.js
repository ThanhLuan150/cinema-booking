const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const giftCardRoutes = require('./giftCard.routes');
const GiftCard = require('../models/GiftCard');

const app = buildTestApp('/api/gift-cards', giftCardRoutes);

beforeAll(async () => connect());
beforeEach(async () => seedRbac());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('giftCard.routes wiring', () => {
  it('GET /api/gift-cards requires auth', async () => {
    const res = await request(app).get('/api/gift-cards');
    expect(res.status).toBe(401);
  });

  it('GET /api/gift-cards rejects a role with no giftCard.read grant', async () => {
    const res = await request(app).get('/api/gift-cards').set('Authorization', authHeader({ role: 3 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/gift-cards scopes a customer (OWN) to only their own cards, never another\'s', async () => {
    await GiftCard.create([
      { id: 1, code: 'MINE', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 42 },
      { id: 2, code: 'NOTMINE', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 },
    ]);
    const res = await request(app)
      .get('/api/gift-cards')
      .set('Authorization', authHeader({ role: 1, accountId: 42 }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].code).toBe('MINE');
  });

  it('GET /api/gift-cards/mine allows a customer (OWN scope)', async () => {
    const res = await request(app).get('/api/gift-cards/mine').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/gift-cards/mine rejects a role with no giftCard.read grant', async () => {
    const res = await request(app).get('/api/gift-cards/mine').set('Authorization', authHeader({ role: 3 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/gift-cards/:id/history lets the card owner (customer) view their own history', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 42 });
    const res = await request(app)
      .get('/api/gift-cards/1/history')
      .set('Authorization', authHeader({ role: 1, accountId: 42 }));
    expect(res.status).toBe(200);
  });

  it('GET /api/gift-cards/:id/history forbids a customer viewing a card they do not own', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 });
    const res = await request(app)
      .get('/api/gift-cards/1/history')
      .set('Authorization', authHeader({ role: 1, accountId: 42 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/gift-cards/:id/history lets an admin (ALL scope) view any card, even one they do not own', async () => {
    await GiftCard.create({ id: 1, code: 'GC1', initial_balance: 1000, remaining_balance: 1000, owner_account_id: 99 });
    const res = await request(app)
      .get('/api/gift-cards/1/history')
      .set('Authorization', authHeader({ role: 0, accountId: 1 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/gift-cards/redeem only requires auth (any role)', async () => {
    const res = await request(app)
      .post('/api/gift-cards/redeem')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'NOPE' });
    expect(res.status).toBe(400); // reached controller, no such code
  });

  it('POST /api/gift-cards requires admin/branch-admin role', async () => {
    const res = await request(app)
      .post('/api/gift-cards')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ code: 'X', initial_balance: 1000 });
    expect(res.status).toBe(403);
  });

  it('PUT /api/gift-cards/:id requires admin/branch-admin role', async () => {
    const res = await request(app)
      .put('/api/gift-cards/1')
      .set('Authorization', authHeader({ role: 1 }))
      .send({});
    expect(res.status).toBe(403);
  });
});
