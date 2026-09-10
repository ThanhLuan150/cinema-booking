const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const privateEventRoutes = require('./privateEvent.routes');
const Branch = require('../models/Branch');
const Room = require('../models/Room');
const Schedule = require('../models/Schedule');
const EventPackage = require('../models/EventPackage');

const app = buildTestApp('/api/private-events', privateEventRoutes);

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
  await seedFixtures();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const OWNER_A = 42;
const OWNER_B = 99;
const CUSTOMER = 7;
const CUSTOMER_2 = 8;

const adminAuth = () => authHeader({ role: 0, accountId: 1 });
const ownerAAuth = () => authHeader({ role: 2, accountId: OWNER_A });
const ownerBAuth = () => authHeader({ role: 2, accountId: OWNER_B });
const customerAuth = () => authHeader({ role: 1, accountId: CUSTOMER });
const customer2Auth = () => authHeader({ role: 1, accountId: CUSTOMER_2 });

function pad2(n) {
  return String(n).padStart(2, '0');
}

// A window a few days out, expressed in LOCAL wall-clock parts so the derived Schedule
// movie_date / time strings line up with eventWindow's local-time comparison regardless of
// the machine timezone.
function futureWindow({ dayOffset = 5, startHour = 18, endHour = 22 } = {}) {
  const base = new Date();
  base.setDate(base.getDate() + dayOffset);
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();
  const start = new Date(y, m, d, startHour, 0, 0, 0);
  const end = new Date(y, m, d, endHour, 0, 0, 0);
  return {
    start,
    end,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    movie_date: `${y}-${pad2(m + 1)}-${pad2(d)}`,
    hhmm: (h) => `${pad2(h)}:00`,
  };
}

async function seedFixtures() {
  await Branch.create([
    { id: 1, company_id: 1, owner_id: OWNER_A, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: OWNER_B, name: 'Branch B', code: 'B' },
  ]);
  await Room.create([
    { id: 10, cinema_id: 1, name: 'Hall 1', code: 'H1', capacity: 100, status: 'ACTIVE' },
    { id: 11, cinema_id: 1, name: 'Hall 2 (closed)', code: 'H2', capacity: 100, status: 'CLOSED' },
    { id: 20, cinema_id: 2, name: 'B-Hall 1', code: 'BH1', capacity: 100, status: 'ACTIVE' },
  ]);
  await EventPackage.create([
    { id: 100, name: 'Basic', code: 'BASIC', base_price: 1000000, status: 'ACTIVE', max_guests: 80 },
    { id: 101, name: 'Retired', code: 'RETIRED', base_price: 500000, status: 'INACTIVE' },
  ]);
}

function requestBody(overrides = {}) {
  const w = futureWindow();
  return {
    branch_id: 1,
    room_id: 10,
    package_id: 100,
    start_at: w.start_at,
    end_at: w.end_at,
    guest_count: 30,
    title: 'Birthday screening',
    ...overrides,
  };
}

describe('privateEvent.routes — wiring & RBAC', () => {
  it('requires auth', async () => {
    const res = await request(app).post('/api/private-events').send(requestBody());
    expect(res.status).toBe(401);
  });

  it('lets a customer file a request (REQUESTED)', async () => {
    const res = await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('REQUESTED');
    expect(res.body.customer_id).toBe(CUSTOMER);
  });

  it('forbids a customer from the admin list endpoint', async () => {
    const res = await request(app).get('/api/private-events?branchId=1').set('Authorization', customerAuth());
    expect(res.status).toBe(403);
  });

  it('requires branchId for a branch-scoped admin listing without one', async () => {
    const res = await request(app).get('/api/private-events').set('Authorization', ownerAAuth());
    expect(res.status).toBe(400);
  });

  it('lets SUPER_ADMIN list across every branch', async () => {
    await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    const res = await request(app).get('/api/private-events').set('Authorization', adminAuth());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });
});

describe('privateEvent.routes — conflict detection', () => {
  it('rejects a request overlapping an ACTIVE showtime in the room', async () => {
    const w = futureWindow();
    await Schedule.create({
      id: 500,
      movie_id: 1,
      room_id: 10,
      cinema_id: 1,
      movie_date: w.movie_date,
      time_begin: w.hhmm(20), // 20:00–21:30 sits inside the 18:00–22:00 request
      time_end: '21:30',
      price: 90000,
      status: 'ACTIVE',
    });

    const res = await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('SHOWTIME_CONFLICT');
    expect(res.body.conflict.schedule_id).toBe(500);
  });

  it('allows a request when the only showtime in the room is CANCELLED', async () => {
    const w = futureWindow();
    await Schedule.create({
      id: 501,
      movie_id: 1,
      room_id: 10,
      cinema_id: 1,
      movie_date: w.movie_date,
      time_begin: w.hhmm(19),
      time_end: '21:00',
      price: 90000,
      status: 'CANCELLED',
    });

    const res = await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    expect(res.status).toBe(201);
  });

  it('rejects a request whose room is not ACTIVE', async () => {
    const res = await request(app)
      .post('/api/private-events')
      .set('Authorization', customerAuth())
      .send(requestBody({ room_id: 11 }));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ROOM_NOT_AVAILABLE');
  });

  it('rejects a request whose room belongs to a different branch', async () => {
    const res = await request(app)
      .post('/api/private-events')
      .set('Authorization', customerAuth())
      .send(requestBody({ room_id: 20 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ROOM_BRANCH_MISMATCH');
  });

  it('rejects a request overlapping another non-cancelled private event', async () => {
    const first = await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/private-events')
      .set('Authorization', customer2Auth())
      .send(requestBody({ guest_count: 10 }));
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('EVENT_CONFLICT');
  });

  it('rejects an INACTIVE package', async () => {
    const res = await request(app)
      .post('/api/private-events')
      .set('Authorization', customerAuth())
      .send(requestBody({ package_id: 101 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PACKAGE_NOT_ACTIVE');
  });

  it('rejects a guest_count above the package cap', async () => {
    const res = await request(app)
      .post('/api/private-events')
      .set('Authorization', customerAuth())
      .send(requestBody({ guest_count: 200 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('GUEST_COUNT_EXCEEDS_PACKAGE');
  });
});

describe('privateEvent.routes — authorization / branch isolation', () => {
  async function fileRequest() {
    const res = await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    return res.body.id;
  }

  it("forbids a branch admin from listing another branch's events", async () => {
    await fileRequest();
    const res = await request(app).get('/api/private-events?branchId=1').set('Authorization', ownerBAuth());
    expect(res.status).toBe(403);
  });

  it("forbids a branch admin from quoting another branch's event", async () => {
    const id = await fileRequest();
    const res = await request(app)
      .post(`/api/private-events/${id}/quote`)
      .set('Authorization', ownerBAuth())
      .send({ quoted_amount: 1 });
    expect(res.status).toBe(403);
  });

  it("lets the owning branch admin quote, but forbids a customer from quoting", async () => {
    const id = await fileRequest();

    const denied = await request(app)
      .post(`/api/private-events/${id}/quote`)
      .set('Authorization', customerAuth())
      .send({ quoted_amount: 1 });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post(`/api/private-events/${id}/quote`)
      .set('Authorization', ownerAAuth())
      .send({ quoted_amount: 2500000, quote_notes: 'incl. cleaning' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('QUOTED');
    expect(ok.body.quoted_amount).toBe(2500000);
  });

  it("forbids a customer from reading someone else's event", async () => {
    const id = await fileRequest();
    const res = await request(app).get(`/api/private-events/${id}`).set('Authorization', customer2Auth());
    expect(res.status).toBe(403);
  });

  it('lets the owner customer read their own event and list it via /mine', async () => {
    const id = await fileRequest();
    const one = await request(app).get(`/api/private-events/${id}`).set('Authorization', customerAuth());
    expect(one.status).toBe(200);

    const mine = await request(app).get('/api/private-events/mine').set('Authorization', customerAuth());
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBe(1);
  });
});

describe('privateEvent.routes — full lifecycle', () => {
  it('request -> quote -> approve -> pay -> confirm -> complete', async () => {
    const created = await request(app)
      .post('/api/private-events')
      .set('Authorization', customerAuth())
      .send(requestBody());
    const id = created.body.id;

    const quote = await request(app)
      .post(`/api/private-events/${id}/quote`)
      .set('Authorization', ownerAAuth())
      .send({ quoted_amount: 3000000 });
    expect(quote.body.status).toBe('QUOTED');

    const approve = await request(app).post(`/api/private-events/${id}/approve`).set('Authorization', ownerAAuth());
    expect(approve.body.status).toBe('APPROVED');

    // a customer pays their own approved event
    const pay = await request(app).post(`/api/private-events/${id}/pay`).set('Authorization', customerAuth());
    expect(pay.body.status).toBe('PAID');
    expect(pay.body.paid_at).toBeTruthy();

    const confirm = await request(app).post(`/api/private-events/${id}/confirm`).set('Authorization', ownerAAuth());
    expect(confirm.body.status).toBe('CONFIRMED');

    const complete = await request(app).post(`/api/private-events/${id}/complete`).set('Authorization', ownerAAuth());
    expect(complete.body.status).toBe('COMPLETED');
  });

  it('blocks paying when a showtime landed in the room after approval', async () => {
    const w = futureWindow();
    const created = await request(app)
      .post('/api/private-events')
      .set('Authorization', customerAuth())
      .send(requestBody());
    const id = created.body.id;
    await request(app)
      .post(`/api/private-events/${id}/quote`)
      .set('Authorization', ownerAAuth())
      .send({ quoted_amount: 100 });
    await request(app).post(`/api/private-events/${id}/approve`).set('Authorization', ownerAAuth());

    await Schedule.create({
      id: 600,
      movie_id: 1,
      room_id: 10,
      cinema_id: 1,
      movie_date: w.movie_date,
      time_begin: w.hhmm(19),
      time_end: '21:00',
      price: 90000,
      status: 'ACTIVE',
    });

    const pay = await request(app).post(`/api/private-events/${id}/pay`).set('Authorization', customerAuth());
    expect(pay.status).toBe(409);
    expect(pay.body.code).toBe('SHOWTIME_CONFLICT');
  });

  it('lets the customer cancel their own request, and the admin reject one', async () => {
    const a = await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    const cancel = await request(app)
      .post(`/api/private-events/${a.body.id}/cancel`)
      .set('Authorization', customerAuth())
      .send({ reason: 'plans changed' });
    expect(cancel.body.status).toBe('CANCELLED');

    // slot is free again -> a second request for the same window now succeeds
    const b = await request(app).post('/api/private-events').set('Authorization', customer2Auth()).send(requestBody());
    expect(b.status).toBe(201);

    const reject = await request(app)
      .post(`/api/private-events/${b.body.id}/reject`)
      .set('Authorization', ownerAAuth())
      .send({ reason: 'room double-booked offline' });
    expect(reject.body.status).toBe('CANCELLED');
  });
});

describe('privateEvent.routes — packages', () => {
  it('lets SUPER_ADMIN create a package but forbids a branch admin', async () => {
    const denied = await request(app)
      .post('/api/private-events/packages')
      .set('Authorization', ownerAAuth())
      .send({ name: 'Deluxe', code: 'DELUXE', base_price: 9000000 });
    expect(denied.status).toBe(403);

    const ok = await request(app)
      .post('/api/private-events/packages')
      .set('Authorization', adminAuth())
      .send({ name: 'Deluxe', code: 'deluxe', base_price: 9000000, max_guests: 150 });
    expect(ok.status).toBe(201);
    expect(ok.body.code).toBe('DELUXE');
  });

  it('lets a customer read the package catalogue', async () => {
    const res = await request(app).get('/api/private-events/packages?status=ACTIVE').set('Authorization', customerAuth());
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.code)).toContain('BASIC');
  });

  it('refuses to delete a package that events reference', async () => {
    await request(app).post('/api/private-events').set('Authorization', customerAuth()).send(requestBody());
    const res = await request(app).delete('/api/private-events/packages/100').set('Authorization', adminAuth());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PACKAGE_IN_USE');
  });
});
