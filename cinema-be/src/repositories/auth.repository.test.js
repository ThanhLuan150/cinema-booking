const { connect, closeDatabase, clearDatabase } = require('../../tests/dbTestUtils');
const authRepository = require('./auth.repository');
const Account = require('../models/Account');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

async function seedAccount(overrides = {}) {
  return Account.create({
    id: 1,
    email: 'user@example.com',
    password: 'hashed-pw',
    ...overrides,
  });
}

describe('auth.repository', () => {
  it('findByEmailForLogin is case-insensitive and includes the password', async () => {
    await seedAccount();
    const account = await authRepository.findByEmailForLogin('USER@example.com');
    expect(account).not.toBeNull();
    expect(account.password).toBe('hashed-pw');
  });

  it('findByEmail excludes the password field by default', async () => {
    await seedAccount();
    const account = await authRepository.findByEmail('user@example.com');
    expect(account.password).toBeUndefined();
  });

  it('findByFilter returns all matching accounts', async () => {
    await seedAccount({ id: 1, email: 'a@example.com', role: 1 });
    await seedAccount({ id: 2, email: 'b@example.com', role: 2 });
    const result = await authRepository.findByFilter({ role: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('b@example.com');
  });

  it('createAccount persists a new account', async () => {
    const account = await authRepository.createAccount({ id: 5, email: 'new@example.com', password: 'x' });
    expect(account.id).toBe(5);
    const found = await Account.findOne({ id: 5 });
    expect(found).not.toBeNull();
  });

  it('saveAccount persists in-memory mutations', async () => {
    const account = await seedAccount();
    account.name = 'Updated';
    await authRepository.saveAccount(account);
    const found = await Account.findOne({ id: 1 });
    expect(found.name).toBe('Updated');
  });

  it('updateProfileByEmail updates name and phone', async () => {
    await seedAccount();
    const updated = await authRepository.updateProfileByEmail('user@example.com', { name: 'Jane', phone: '123' });
    expect(updated.name).toBe('Jane');
    expect(updated.phone).toBe('123');
  });

  it('findByEmailWithOtp includes otp fields', async () => {
    await seedAccount({ otp: '123456', otpExpiresAt: new Date() });
    const account = await authRepository.findByEmailWithOtp('user@example.com');
    expect(account.otp).toBe('123456');
  });

  it('findByEmailWithOtpAndPassword includes both otp and password', async () => {
    await seedAccount({ otp: '123456' });
    const account = await authRepository.findByEmailWithOtpAndPassword('user@example.com');
    expect(account.otp).toBe('123456');
    expect(account.password).toBe('hashed-pw');
  });

  it('findByIdWithPassword includes the password', async () => {
    await seedAccount();
    const account = await authRepository.findByIdWithPassword(1);
    expect(account.password).toBe('hashed-pw');
  });

  it('findById returns the account without the password', async () => {
    await seedAccount();
    const account = await authRepository.findById(1);
    expect(account.password).toBeUndefined();
  });

  it('findById returns null for a non-existent id', async () => {
    const account = await authRepository.findById(999);
    expect(account).toBeNull();
  });
});
