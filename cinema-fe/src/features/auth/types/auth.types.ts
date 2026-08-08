import type { Account } from '@/types/entities';

export interface AuthState {
  accessToken: string | null;
  userId: string | null;
  role: string | null;
  account: Account | null;
}

export interface LoginPayload {
  accessToken: string;
  userId: string;
  role: string;
  account: Account;
}

export interface LoginResponse {
  accessToken: string;
  account: Account;
  user_id: string;
  role: string;
}

export interface SaveUserInfoPayload {
  name: string;
  phone: string;
  email: string;
}

export interface RegisterVariables {
  email: string;
  password: string;
  c_password: string;
}

export interface VerifyCodePayload {
  email: string;
  otp: string;
}

export interface CurrentUser {
  user_id: string | number;
  email: string;
  name: string;
  phone: string;
  avatar?: string;
  role: number;
  cinema_id?: number; // present for employee (role 3) accounts — the cinema they're staffed at
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
  avatar?: string;
}

export interface ProfileMovie {
  id: number;
  name: string;
  avatar: string;
  categories?: { id: number; name: string }[];
}
