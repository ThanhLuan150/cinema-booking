jest.mock('./utils/socket', () => ({ emitPublic: jest.fn(), emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitToAccount: jest.fn() }));
jest.mock('./utils/uploadImage', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://cdn.example.com/a.jpg'),
  uploadTrailer: jest.fn().mockResolvedValue('https://cdn.example.com/t.mp4'),
}));

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../tests/dbTestUtils');
const app = require('./app');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('app', () => {
  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('mounts api routes under /api', async () => {
    const res = await request(app).get('/api/movie');
    expect(res.status).toBe(200);
  });

  it('returns 404 via notFound middleware for an unknown route', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Route not found: GET /does-not-exist');
  });
});
