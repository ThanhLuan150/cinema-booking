import { describe, expect, it, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { STORAGE_KEYS } from '@/constants/storage';
import { store } from '@/app/store';
import { login, logout } from '@/features/auth/store/authSlice';
import apiClient from './apiClient';

function rejectedHandler() {
  return apiClient.interceptors.response.handlers[0].rejected;
}

describe('apiClient request interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('attaches an Authorization header when a token is stored', async () => {
    localStorage.setItem(STORAGE_KEYS.accessToken, 'abc123');
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBe('Bearer abc123');
  });

  it('leaves the Authorization header unset when there is no token', async () => {
    const config = await apiClient.interceptors.request.handlers[0].fulfilled({ headers: {} });
    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe('apiClient response interceptor (401 refresh)', () => {
  beforeEach(() => {
    store.dispatch(logout());
    vi.restoreAllMocks();
  });

  it('passes through non-401 errors unchanged', async () => {
    const error = { config: { url: '/movie' }, response: { status: 500 } };
    await expect(rejectedHandler()(error)).rejects.toBe(error);
  });

  it('does not attempt a refresh for a 401 on /Login itself', async () => {
    const postSpy = vi.spyOn(axios, 'post');
    const error = { config: { url: '/Login' }, response: { status: 401 } };
    await expect(rejectedHandler()(error)).rejects.toBe(error);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('does not retry a request that has already been retried once', async () => {
    const postSpy = vi.spyOn(axios, 'post');
    const error = { config: { url: '/user', _retry: true }, response: { status: 401 } };
    await expect(rejectedHandler()(error)).rejects.toBe(error);
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('on a 401, silently refreshes the access token and updates the store', async () => {
    store.dispatch(login({ accessToken: 'old-tok', userId: '1', role: '1', account: {} }));
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { accessToken: 'new-access-token' } });

    const error = { config: { url: '/user', headers: {} }, response: { status: 401 } };
    // The retried request itself hits the network in this test env and will reject;
    // we only assert the refresh side-effects happened before that.
    await rejectedHandler()(error).catch(() => {});

    expect(store.getState().auth.accessToken).toBe('new-access-token');
    expect(error.config._retry).toBe(true);
    expect(error.config.headers.Authorization).toBe('Bearer new-access-token');
  });

  it('logs out when the refresh call itself fails', async () => {
    store.dispatch(login({ accessToken: 'old-tok', userId: '1', role: '1', account: {} }));
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('refresh failed'));

    const error = { config: { url: '/user', headers: {} }, response: { status: 401 } };
    await expect(rejectedHandler()(error)).rejects.toThrow('refresh failed');

    expect(store.getState().auth.accessToken).toBeNull();
  });
});
