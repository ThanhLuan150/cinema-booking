import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Account } from '@/types/entities';
import type { AuthState, LoginPayload } from '../types/auth.types';
import { STORAGE_KEYS } from '@/constants/storage';

function loadInitialState(): AuthState {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const userId = localStorage.getItem(STORAGE_KEYS.userId);
  const role = localStorage.getItem(STORAGE_KEYS.role);
  const rawAccount = localStorage.getItem(STORAGE_KEYS.account);
  return {
    token,
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
      const { token, userId, role, account } = action.payload;
      state.token = token;
      state.userId = userId;
      state.role = role;
      state.account = account;

      localStorage.setItem(STORAGE_KEYS.token, token);
      localStorage.setItem(STORAGE_KEYS.userId, userId);
      localStorage.setItem(STORAGE_KEYS.role, role);
      localStorage.setItem(STORAGE_KEYS.account, JSON.stringify(account));
    },
    logout(state) {
      state.token = null;
      state.userId = null;
      state.role = null;
      state.account = null;

      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.userId);
      localStorage.removeItem(STORAGE_KEYS.role);
      localStorage.removeItem(STORAGE_KEYS.account);
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
