import { describe, expect, it, vi, beforeEach } from 'vitest';

const postMock = vi.fn();
const getMock = vi.fn();
const putMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    post: (...args: unknown[]) => postMock(...args),
    get: (...args: unknown[]) => getMock(...args),
    put: (...args: unknown[]) => putMock(...args),
  },
}));

import * as authApi from './auth.api';

describe('auth.api', () => {
  beforeEach(() => {
    postMock.mockReset();
    getMock.mockReset();
    putMock.mockReset();
  });

  it('login posts to /Login with email and password', () => {
    authApi.login('a@b.com', 'secret');
    expect(postMock).toHaveBeenCalledWith('/Login', { email: 'a@b.com', password: 'secret' });
  });

  it('checkEmailExists gets /check-email with an encoded email', () => {
    authApi.checkEmailExists('a b@c.com');
    expect(getMock).toHaveBeenCalledWith('/check-email?email=a%20b%40c.com');
  });

  it('register posts to /register with a numeric role', () => {
    authApi.register('a@b.com', 'pw', 'pw', 1);
    expect(postMock).toHaveBeenCalledWith('/register', { email: 'a@b.com', password: 'pw', c_password: 'pw', role: 1 });
  });

  it('getAccountByEmail gets /account/:email', () => {
    authApi.getAccountByEmail('a@b.com');
    expect(getMock).toHaveBeenCalledWith('/account/a@b.com');
  });

  it('saveUserInfo posts to /users', () => {
    const payload = { name: 'A', phone: '123', email: 'a@b.com' };
    authApi.saveUserInfo(payload);
    expect(postMock).toHaveBeenCalledWith('/users', payload);
  });

  it('saveCinemaInfo posts to /cinema/onboard', () => {
    const payload = { name: 'A', address: 'B', city: 'C', email: 'a@b.com' } as any;
    authApi.saveCinemaInfo(payload);
    expect(postMock).toHaveBeenCalledWith('/cinema/onboard', payload);
  });

  it('verifyCode posts to /verify', () => {
    const payload = { email: 'a@b.com', otp: '123456' };
    authApi.verifyCode(payload);
    expect(postMock).toHaveBeenCalledWith('/verify', payload);
  });

  it('getAccountsByEmail gets /account with a query string', () => {
    authApi.getAccountsByEmail('a@b.com');
    expect(getMock).toHaveBeenCalledWith('/account?email=a@b.com');
  });

  it('resendCode posts to /resend/:accountId', () => {
    authApi.resendCode(42);
    expect(postMock).toHaveBeenCalledWith('/resend/42');
  });

  it('getCurrentUser gets /user', () => {
    authApi.getCurrentUser();
    expect(getMock).toHaveBeenCalledWith('/user');
  });

  it('updateProfile puts to /user', () => {
    const payload = { name: 'A' } as any;
    authApi.updateProfile(payload);
    expect(putMock).toHaveBeenCalledWith('/user', payload);
  });

  it('forgotPassword posts to /forgot-password', () => {
    authApi.forgotPassword('a@b.com');
    expect(postMock).toHaveBeenCalledWith('/forgot-password', { email: 'a@b.com' });
  });

  it('resetPassword posts to /reset-password', () => {
    const payload = { email: 'a@b.com', otp: '123456', password: 'p', c_password: 'p' };
    authApi.resetPassword(payload);
    expect(postMock).toHaveBeenCalledWith('/reset-password', payload);
  });

  it('changePassword posts to /change-password', () => {
    const payload = { currentPassword: 'old', newPassword: 'new', c_password: 'new' };
    authApi.changePassword(payload);
    expect(postMock).toHaveBeenCalledWith('/change-password', payload);
  });
});
