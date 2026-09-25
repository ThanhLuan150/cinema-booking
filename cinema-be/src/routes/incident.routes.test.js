const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const seedRbac = require('../seed/seedRbac');
const seedPositions = require('../seed/seedPositions');
const incidentRoutes = require('./incident.routes');
const Branch = require('../models/Branch');
const Employee = require('../models/Employee');
const Incident = require('../models/Incident');
const Position = require('../models/Position');
const Room = require('../models/Room');

const app = buildTestApp('/api/incidents', incidentRoutes);

const SECURITY_A = 70; // SECURITY at branch 1
const SECURITY_B = 71; // SECURITY at branch 2

const asEmployee = (accountId) => authHeader({ role: 3, accountId });
const asAdminA = () => authHeader({ role: 2, accountId: 42 }); // owns branch 1
const asSuperAdmin = () => authHeader({ role: 0, accountId: 1 });

beforeAll(async () => connect());
beforeEach(async () => {
  await seedRbac();
  await seedPositions();
  const security = await Position.findOne({ code: 'SECURITY' });
  await Branch.create([
    { id: 1, company_id: 1, owner_id: 42, name: 'Branch A', code: 'A' },
    { id: 2, company_id: 1, owner_id: 99, name: 'Branch B', code: 'B' },
  ]);
  await Employee.create([
    { id: 1, user_id: SECURITY_A, branch_id: 1, employee_code: 'E1', position_id: security.id, status: 1 },
    { id: 2, user_id: SECURITY_B, branch_id: 2, employee_code: 'E2', position_id: security.id, status: 1 },
  ]);
  await Room.create({ id: 10, cinema_id: 1, name: 'Room 1', code: 'R1' });
  await Room.create({ id: 20, cinema_id: 2, name: 'Room 2', code: 'R2' });
});
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

const validReport = (overrides = {}) => ({
  branch_id: 1,
  category: 'DISTURBANCE',
  severity: 'HIGH',
  title: 'Argument in the lobby',
  description: 'Two guests, no injuries.',
  ...overrides,
});

describe('incident.routes', () => {
  it('requires auth', async () => {
    expect((await request(app).post('/api/incidents').send(validReport())).status).toBe(401);
    expect((await request(app).get('/api/incidents').query({ branchId: 1 })).status).toBe(401);
  });

  it('files an incident, recording the caller as reporter and never trusting a body reporter', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', asEmployee(SECURITY_A))
      .send(validReport({ room_id: 10, reported_by: 999 }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ branch_id: 1, room_id: 10, category: 'DISTURBANCE', severity: 'HIGH', reported_by: SECURITY_A });
    expect(await Incident.countDocuments()).toBe(1);
  });

  it('validates the payload', async () => {
    const post = (body) => request(app).post('/api/incidents').set('Authorization', asEmployee(SECURITY_A)).send(body);
    expect((await post({ branch_id: 1, title: 'x' })).status).toBe(400);
    expect((await post(validReport({ title: '   ' }))).status).toBe(400);
    expect((await post(validReport({ category: 'NOPE' }))).body.code).toBe('INVALID_CATEGORY');
    expect((await post(validReport({ severity: 'EXTREME' }))).body.code).toBe('INVALID_SEVERITY');
    expect(await Incident.countDocuments()).toBe(0);
  });

  it('defaults severity to LOW', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', asEmployee(SECURITY_A))
      .send(validReport({ severity: undefined }));
    expect(res.body.severity).toBe('LOW');
  });

  it('refuses a room that belongs to another branch, without revealing it exists', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', asEmployee(SECURITY_A))
      .send(validReport({ room_id: 20 }));
    expect(res.status).toBe(404);
  });

  it('forbids reporting into a branch the employee is not staffed at', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', asEmployee(SECURITY_A))
      .send(validReport({ branch_id: 2 }));
    expect(res.status).toBe(403);
  });

  it('lists only the caller branch and requires a branchId for a branch-scoped caller', async () => {
    await Incident.create([
      { id: 1, branch_id: 1, category: 'OTHER', title: 'A1', reported_by: 1 },
      { id: 2, branch_id: 2, category: 'OTHER', title: 'B1', reported_by: 2 },
    ]);
    const own = await request(app).get('/api/incidents').query({ branchId: 1 }).set('Authorization', asEmployee(SECURITY_A));
    expect(own.status).toBe(200);
    expect(own.body.data.map((i) => i.title)).toEqual(['A1']);

    expect((await request(app).get('/api/incidents').set('Authorization', asEmployee(SECURITY_A))).status).toBe(400);
    const cross = await request(app).get('/api/incidents').query({ branchId: 2 }).set('Authorization', asEmployee(SECURITY_A));
    expect(cross.status).toBe(403);
  });

  it('a branch admin reads their own branch only; a super admin reads across branches', async () => {
    await Incident.create([
      { id: 1, branch_id: 1, category: 'OTHER', title: 'A1', reported_by: 1 },
      { id: 2, branch_id: 2, category: 'OTHER', title: 'B1', reported_by: 2 },
    ]);
    expect((await request(app).get('/api/incidents').query({ branchId: 1 }).set('Authorization', asAdminA())).status).toBe(200);
    expect((await request(app).get('/api/incidents').query({ branchId: 2 }).set('Authorization', asAdminA())).status).toBe(403);
    const all = await request(app).get('/api/incidents').set('Authorization', asSuperAdmin());
    expect(all.body.total).toBe(2);
  });

  it('GET /:id is branch-scoped', async () => {
    await Incident.create({ id: 1, branch_id: 2, category: 'OTHER', title: 'B1', reported_by: 2 });
    expect((await request(app).get('/api/incidents/1').set('Authorization', asEmployee(SECURITY_A))).status).toBe(403);
    expect((await request(app).get('/api/incidents/1').set('Authorization', asEmployee(SECURITY_B))).status).toBe(200);
    expect((await request(app).get('/api/incidents/999').set('Authorization', asEmployee(SECURITY_B))).status).toBe(404);
  });

  it('a customer can neither file nor read incidents', async () => {
    const customer = authHeader({ role: 1, accountId: 5 });
    expect((await request(app).post('/api/incidents').set('Authorization', customer).send(validReport())).status).toBe(403);
    expect((await request(app).get('/api/incidents').query({ branchId: 1 }).set('Authorization', customer)).status).toBe(403);
  });
});
