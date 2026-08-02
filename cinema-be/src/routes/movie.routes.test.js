jest.mock('../utils/socket', () => ({ emitPublic: jest.fn(), emitToAdmin: jest.fn(), emitToOwner: jest.fn() }));
jest.mock('../utils/uploadImage', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://cdn.example.com/a.jpg'),
  uploadTrailer: jest.fn().mockResolvedValue('https://cdn.example.com/t.mp4'),
}));

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp, authHeader } = require('../../tests/routeTestUtils');
const movieRoutes = require('./movie.routes');

const app = buildTestApp('/api/movie', movieRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('movie.routes wiring', () => {
  it('GET /api/movie is public', async () => {
    const res = await request(app).get('/api/movie');
    expect(res.status).toBe(200);
  });

  it('GET /api/movie/mine requires admin/theater-staff role', async () => {
    const res = await request(app).get('/api/movie/mine').set('Authorization', authHeader({ role: 1 }));
    expect(res.status).toBe(403);
  });

  it('GET /api/movie/mine allows theater staff', async () => {
    const res = await request(app).get('/api/movie/mine').set('Authorization', authHeader({ role: 2, accountId: 1 }));
    expect(res.status).toBe(200);
  });

  it('POST /api/movie requires auth', async () => {
    const res = await request(app).post('/api/movie').send({ name: 'A', premiere_date: '2026-01-01' });
    expect(res.status).toBe(401);
  });

  it('POST /api/movie rejects a plain user', async () => {
    const res = await request(app)
      .post('/api/movie')
      .set('Authorization', authHeader({ role: 1 }))
      .send({ name: 'A', premiere_date: '2026-01-01' });
    expect(res.status).toBe(403);
  });

  it('POST /api/movie allows theater staff and reaches the controller', async () => {
    const res = await request(app)
      .post('/api/movie')
      .set('Authorization', authHeader({ role: 2, accountId: 42 }))
      .send({ name: 'New Movie', premiere_date: '2026-01-01' });
    expect(res.status).toBe(201);
  });
});
