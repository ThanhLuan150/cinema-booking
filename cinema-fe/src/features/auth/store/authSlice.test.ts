import { beforeEach, describe, expect, it } from 'vitest';
import type { Account } from '@/types/entities';
import { STORAGE_KEYS } from '@/constants/storage';
import reducer, { login, logout } from './authSlice';

const account = { id: 'u1', name: 'Test User' } as unknown as Account;

describe('authSlice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the initial state when nothing is stored', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ token: null, userId: null, role: null, account: null });
  });

  it('login stores the payload in state and localStorage', () => {
    const state = reducer(undefined, login({ token: 'tok', userId: 'u1', role: 'user', account }));
    expect(state).toEqual({ token: 'tok', userId: 'u1', role: 'user', account });
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBe('tok');
    expect(localStorage.getItem(STORAGE_KEYS.userId)).toBe('u1');
    expect(localStorage.getItem(STORAGE_KEYS.role)).toBe('user');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.account)!)).toEqual(account);
  });

  it('logout clears state and localStorage', () => {
    const loggedIn = reducer(undefined, login({ token: 'tok', userId: 'u1', role: 'user', account }));
    const state = reducer(loggedIn, logout());
    expect(state).toEqual({ token: null, userId: null, role: null, account: null });
    expect(localStorage.getItem(STORAGE_KEYS.token)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.userId)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.role)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.account)).toBeNull();
  });
});
