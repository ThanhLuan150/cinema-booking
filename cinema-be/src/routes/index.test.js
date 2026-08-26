jest.mock('../utils/socket', () => ({ emitPublic: jest.fn(), emitToAdmin: jest.fn(), emitToOwner: jest.fn(), emitToAccount: jest.fn() }));
jest.mock('../utils/uploadImage', () => ({
  uploadImage: jest.fn().mockResolvedValue('https://cdn.example.com/a.jpg'),
  uploadTrailer: jest.fn().mockResolvedValue('https://cdn.example.com/t.mp4'),
}));

const request = require('supertest');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const { buildTestApp } = require('../../tests/routeTestUtils');
const apiRoutes = require('./index');

const app = buildTestApp('/api', apiRoutes);

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('routes/index composition', () => {
  it('mounts auth routes at the root', async () => {
    const res = await request(app).post('/api/Login').send({});
    expect(res.status).toBe(400); // reached auth controller
  });

  it('mounts resource routes under their prefixes', async () => {
    const movie = await request(app).get('/api/movie');
    expect(movie.status).toBe(200);

    const cat = await request(app).get('/api/cat');
    expect(cat.status).toBe(200);

    const cinema = await request(app).get('/api/cinema');
    expect(cinema.status).toBe(200);

    const combo = await request(app).get('/api/combo');
    expect(combo.status).toBe(200);
  });

  it('mounts the booking flow at the root', async () => {
    const res = await request(app).post('/api/scheduleId').send({});
    expect(res.status).toBe(401); // reached booking route's auth guard
  });

  it('mounts the dashboard routes', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('mounts the maintenance routes', async () => {
    const res = await request(app).get('/api/maintenance');
    expect(res.status).toBe(401);
  });
});
