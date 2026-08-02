import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Account } from '@/types/entities';
import type { AuthState, LoginPayload } from '../types/auth.types';
import { STORAGE_KEYS } from '@/constants/storage';

function loadInitialState(): AuthState {
  const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
  const userId = localStorage.getItem(STORAGE_KEYS.userId);
  const role = localStorage.getItem(STORAGE_KEYS.role);
  const rawAccount = localStorage.getItem(STORAGE_KEYS.account);
  return {
    accessToken,
    userId,
    role,
    account: rawAccount ? (JSON.parse(rawAccount) as Account) : null,
  };
}

const initialState: AuthState = loadInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login(state, action: PayloadAction<LoginPayload>) {
      const { accessToken, userId, role, account } = action.payload;
      state.accessToken = accessToken;
      state.userId = userId;
      state.role = role;
      state.account = account;

      localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
      localStorage.setItem(STORAGE_KEYS.userId, userId);
      localStorage.setItem(STORAGE_KEYS.role, role);
      localStorage.setItem(STORAGE_KEYS.account, JSON.stringify(account));
    },
    logout(state) {
      state.accessToken = null;
      state.userId = null;
      state.role = null;
      state.account = null;

      localStorage.removeItem(STORAGE_KEYS.accessToken);
      localStorage.removeItem(STORAGE_KEYS.userId);
      localStorage.removeItem(STORAGE_KEYS.role);
      localStorage.removeItem(STORAGE_KEYS.account);
    },
    // Used after a silent /refresh-token call — updates just the access token,
    // leaving account/userId/role and their localStorage entries untouched.
    setAccessToken(state, action: PayloadAction<string>) {
      state.accessToken = action.payload;
      localStorage.setItem(STORAGE_KEYS.accessToken, action.payload);
    },
  },
});

export const { login, logout, setAccessToken } = authSlice.actions;
export default authSlice.reducer;
