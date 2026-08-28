const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const notificationTemplateRoutes = require('./notificationTemplate.routes');
const NotificationTemplate = require('../models/NotificationTemplate');

const app = buildTestApp('/api/notification-templates', notificationTemplateRoutes);

beforeAll(async () => {
  await connect();
  await NotificationTemplate.init();
});
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const SUPER_ADMIN = { role: 0, accountId: 1 };
const BRANCH_ADMIN = { role: 2, accountId: 5 };
const CUSTOMER = { role: 1, accountId: 9 };

const validBody = {
  event: 'TICKET_ISSUED',
  channel: 'EMAIL',
  subject: 'Ticket for {{customer_name}}',
  content: 'Ticket {{ticket_code}} - {{movie_name}} at {{showtime}}',
  language: 'vi',
  status: 'ACTIVE',
};

async function createTemplate(overrides = {}) {
  const res = await request(app)
    .post('/api/notification-templates')
    .set('Authorization', authHeader(SUPER_ADMIN))
    .send({ ...validBody, ...overrides });
  return res;
}

describe('notificationTemplate.routes — access control', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/notification-templates')).status).toBe(401);
  });

  it('forbids a customer and a branch admin (no notificationTemplate.* grant)', async () => {
    expect((await request(app).get('/api/notification-templates').set('Authorization', authHeader(CUSTOMER))).status).toBe(403);
    expect((await request(app).get('/api/notification-templates').set('Authorization', authHeader(BRANCH_ADMIN))).status).toBe(403);
  });

  it('allows a super admin', async () => {
    const res = await request(app).get('/api/notification-templates').set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('notificationTemplate.routes — CRUD', () => {
  it('GET /meta returns the vocabulary + per-event variables', async () => {
    const res = await request(app).get('/api/notification-templates/meta').set('Authorization', authHeader(SUPER_ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.events).toContain('BOOKING_SUCCESS');
    expect(res.body.supportedChannels).toEqual(['EMAIL', 'IN_APP']);
    expect(res.body.variablesByEvent.TICKET_ISSUED).toContain('ticket_code');
  });

  it('creates, reads, lists, updates and deletes a template', async () => {
    const created = await createTemplate();
    expect(created.status).toBe(201);
    const id = created.body.id;

    const got = await request(app).get(`/api/notification-templates/${id}`).set('Authorization', authHeader(SUPER_ADMIN));
    expect(got.body.content).toContain('{{ticket_code}}');
    expect(got.body.updated_by).toBe(1);

    const listed = await request(app)
      .get('/api/notification-templates?event=TICKET_ISSUED&channel=EMAIL')
      .set('Authorization', authHeader(SUPER_ADMIN));
    expect(listed.body.total).toBe(1);

    const updated = await request(app)
      .put(`/api/notification-templates/${id}`)
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ status: 'INACTIVE' });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe('INACTIVE');

    const removed = await request(app)
      .delete(`/api/notification-templates/${id}`)
      .set('Authorization', authHeader(SUPER_ADMIN));
    expect(removed.status).toBe(200);
    expect((await request(app).get(`/api/notification-templates/${id}`).set('Authorization', authHeader(SUPER_ADMIN))).status).toBe(404);
  });

  it('rejects a duplicate (event, channel, language) with 409', async () => {
    await createTemplate();
    const dup = await createTemplate();
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('DUPLICATE_TEMPLATE');
  });
});

describe('notificationTemplate.routes — validation', () => {
  it('400 with per-field details for an unknown variable', async () => {
    const res = await createTemplate({ event: 'BOOKING_SUCCESS', content: 'Hi {{customer_name}} {{ticket_code}}' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TEMPLATE_INVALID');
    expect(res.body.details.some((d) => d.code === 'UNKNOWN_VARIABLES')).toBe(true);
  });

  it('400 when an EMAIL template has no subject', async () => {
    const res = await createTemplate({ subject: '' });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.field === 'subject')).toBe(true);
  });

  it('400 for the unsupported SMS channel', async () => {
    const res = await createTemplate({ channel: 'SMS' });
    expect(res.status).toBe(400);
    expect(res.body.details.some((d) => d.code === 'CHANNEL_NOT_SUPPORTED')).toBe(true);
  });

  it('re-validates the merged row on update — a patch cannot make it invalid', async () => {
    const created = await createTemplate(); // TICKET_ISSUED, uses {{ticket_code}}
    const res = await request(app)
      .put(`/api/notification-templates/${created.body.id}`)
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ event: 'BOOKING_SUCCESS' }); // BOOKING_SUCCESS can't provide {{ticket_code}}
    expect(res.status).toBe(400);
  });
});

describe('notificationTemplate.routes — preview', () => {
  it('POST /preview renders an ad-hoc body against sample data', async () => {
    const res = await request(app)
      .post('/api/notification-templates/preview')
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ subject: 'Hi {{customer_name}}', content: '{{movie_name}} @ {{showtime}}' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Hi Nguyen Van A');
    expect(res.body.content).toContain('Dune: Part Two');
  });

  it('POST /:id/preview renders the stored template', async () => {
    const created = await createTemplate();
    const res = await request(app)
      .post(`/api/notification-templates/${created.body.id}/preview`)
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ variables: { movie_name: 'Custom' } });
    expect(res.status).toBe(200);
    expect(res.body.content).toContain('Custom');
  });

  it('400 when previewing with no content', async () => {
    const res = await request(app)
      .post('/api/notification-templates/preview')
      .set('Authorization', authHeader(SUPER_ADMIN))
      .send({ subject: 'x' });
    expect(res.status).toBe(400);
  });
});
