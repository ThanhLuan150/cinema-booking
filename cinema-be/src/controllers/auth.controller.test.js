jest.mock('../utils/mailer', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ messageId: 'mock' }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ messageId: 'mock' }),
}));

const express = require('express');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const authController = require('./auth.controller');
const mailer = require('../utils/mailer');
const Account = require('../models/Account');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/Login', authController.login);
  app.get('/api/check-email', authController.checkEmail);
  app.post('/api/register', authController.register);
  app.post('/api/verify', authController.verify);
  app.post('/api/forgot-password', authController.forgotPassword);
  app.post('/api/reset-password', authController.resetPassword);
  return app;
}

const app = buildApp();

beforeAll(async () => connect());
afterEach(async () => {
  await clearDatabase();
  jest.clearAllMocks();
});
afterAll(async () => closeDatabase());

async function createAccount(overrides = {}) {
  const password = overrides.password ?? (await bcrypt.hash('Password1!', 10));
  return Account.create({
    id: overrides.id ?? 1,
    email: overrides.email ?? 'user@example.com',
    password,
    role: overrides.role ?? 1,
    status: overrides.status ?? 1,
    approved: overrides.approved ?? true,
    verified: overrides.verified ?? true,
  });
}

describe('POST /api/Login', () => {
  it('rejects a missing email or password', async () => {
    const res = await request(app).post('/api/Login').send({ email: 'user@example.com' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown account', async () => {
    const res = await request(app).post('/api/Login').send({ email: 'nobody@example.com', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('rejects an unverified account', async () => {
    await createAccount({ verified: false });
    const res = await request(app).post('/api/Login').send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_NOT_VERIFIED');
  });

  it('rejects a locked account', async () => {
    await createAccount({ status: 0 });
    const res = await request(app).post('/api/Login').send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_LOCKED');
  });

  it('rejects an unapproved theater account', async () => {
    await createAccount({ role: 2, approved: false });
    const res = await request(app).post('/api/Login').send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_PENDING_APPROVAL');
  });

  it('rejects an incorrect password', async () => {
    await createAccount();
    const res = await request(app).post('/api/Login').send({ email: 'user@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_PASSWORD');
  });

  it('returns a token and account info for valid credentials', async () => {
    await createAccount();
    const res = await request(app).post('/api/Login').send({ email: 'user@example.com', password: 'Password1!' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user_id).toBe('1');
    expect(res.body.role).toBe('1');
  });
});

describe('GET /api/check-email', () => {
  it('rejects a request with no email query param', async () => {
    const res = await request(app).get('/api/check-email');
    expect(res.status).toBe(400);
  });

  it('reports exists:false for an unknown email', async () => {
    const res = await request(app).get('/api/check-email').query({ email: 'nobody@example.com' });
    expect(res.body).toEqual({ exists: false });
  });

  it('reports exists:true for a known email', async () => {
    await createAccount();
    const res = await request(app).get('/api/check-email').query({ email: 'user@example.com' });
    expect(res.body).toEqual({ exists: true });
  });
});

describe('POST /api/register', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/register').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('rejects mismatched password confirmation', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ email: 'a@b.com', password: 'Password1!', c_password: 'Different1!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_MISMATCH');
  });

  it('rejects registering an email that is already verified', async () => {
    await createAccount({ verified: true });
    const res = await request(app)
      .post('/api/register')
      .send({ email: 'user@example.com', password: 'Password1!', c_password: 'Password1!' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('creates a new unverified account, defaults to role user, and sends the otp email', async () => {
    const res = await request(app)
      .post('/api/register')
      .send({ email: 'new@example.com', password: 'Password1!', c_password: 'Password1!' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('REGISTER_SUCCESS');

    const account = await Account.findOne({ email: 'new@example.com' });
    expect(account.role).toBe(1);
    expect(account.verified).toBe(false);
    expect(account.approved).toBe(true);
    expect(mailer.sendOtpEmail).toHaveBeenCalledWith('new@example.com', expect.any(String));
  });

  it('marks a theater-staff (role 2) registration as unapproved', async () => {
    await request(app)
      .post('/api/register')
      .send({ email: 'owner@example.com', password: 'Password1!', c_password: 'Password1!', role: '2' });

    const account = await Account.findOne({ email: 'owner@example.com' });
    expect(account.role).toBe(2);
    expect(account.approved).toBe(false);
  });

  it('re-registers over an existing unverified account instead of creating a duplicate', async () => {
    await createAccount({ verified: false });
    const before = await Account.countDocuments();

    const res = await request(app)
      .post('/api/register')
      .send({ email: 'user@example.com', password: 'NewPassword1!', c_password: 'NewPassword1!' });

    expect(res.status).toBe(201);
    const after = await Account.countDocuments();
    expect(after).toBe(before);
  });
});

describe('POST /api/verify', () => {
  it('rejects an unknown account', async () => {
    const res = await request(app).post('/api/verify').send({ email: 'nobody@example.com', otp: '123456' });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid otp', async () => {
    await Account.create({
      id: 1,
      email: 'user@example.com',
      password: 'hashed',
      otp: '111111',
      otpExpiresAt: new Date(Date.now() + 60000),
    });

    const res = await request(app).post('/api/verify').send({ email: 'user@example.com', otp: '222222' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OTP_INVALID_OR_EXPIRED');
  });

  it('rejects an expired otp', async () => {
    await Account.create({
      id: 1,
      email: 'user@example.com',
      password: 'hashed',
      otp: '111111',
      otpExpiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).post('/api/verify').send({ email: 'user@example.com', otp: '111111' });
    expect(res.status).toBe(400);
  });

  it('verifies the account and clears the otp for a matching, unexpired code', async () => {
    await Account.create({
      id: 1,
      email: 'user@example.com',
      password: 'hashed',
      otp: '111111',
      otpExpiresAt: new Date(Date.now() + 60000),
    });

    const res = await request(app).post('/api/verify').send({ email: 'user@example.com', otp: '111111' });
    expect(res.status).toBe(200);

    const account = await Account.findOne({ email: 'user@example.com' }).select('+otp +otpExpiresAt');
    expect(account.verified).toBe(true);
    expect(account.otp).toBeNull();
  });
});

describe('POST /api/forgot-password', () => {
  it('rejects an unknown account', async () => {
    const res = await request(app).post('/api/forgot-password').send({ email: 'nobody@example.com' });
    expect(res.status).toBe(404);
  });

  it('generates and emails an otp for a known account', async () => {
    await createAccount();
    const res = await request(app).post('/api/forgot-password').send({ email: 'user@example.com' });
    expect(res.status).toBe(200);
    expect(mailer.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com', expect.any(String));
  });
});

describe('POST /api/reset-password', () => {
  it('rejects mismatched password confirmation', async () => {
    const res = await request(app)
      .post('/api/reset-password')
      .send({ email: 'user@example.com', otp: '111111', password: 'a', c_password: 'b' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_MISMATCH');
  });

  it('rejects an invalid otp', async () => {
    await Account.create({
      id: 1,
      email: 'user@example.com',
      password: 'hashed',
      otp: '111111',
      otpExpiresAt: new Date(Date.now() + 60000),
    });

    const res = await request(app)
      .post('/api/reset-password')
      .send({ email: 'user@example.com', otp: '999999', password: 'New1!', c_password: 'New1!' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OTP_INVALID_OR_EXPIRED');
  });

  it('resets the password when the otp matches', async () => {
    await Account.create({
      id: 1,
      email: 'user@example.com',
      password: await bcrypt.hash('OldPassword1!', 10),
      otp: '111111',
      otpExpiresAt: new Date(Date.now() + 60000),
    });

    const res = await request(app)
      .post('/api/reset-password')
      .send({ email: 'user@example.com', otp: '111111', password: 'NewPassword1!', c_password: 'NewPassword1!' });
    expect(res.status).toBe(200);

    const account = await Account.findOne({ email: 'user@example.com' }).select('+password');
    expect(await bcrypt.compare('NewPassword1!', account.password)).toBe(true);
  });
});
