import apiClient from 'services/apiClient';
import type {
  CurrentUser,
  LoginResponse,
  SaveUserInfoPayload,
  UpdateProfilePayload,
  VerifyCodePayload,
} from '../types/auth.types';

export const login = (email: string, password: string) =>
  apiClient.post<LoginResponse>('/Login', { email, password });

export const refreshAccessToken = () => apiClient.post<{ accessToken: string }>('/refresh-token');

export const logout = () => apiClient.post('/logout');

export const checkEmailExists = (email: string) =>
  apiClient.get<{ exists: boolean }>(`/check-email?email=${encodeURIComponent(email)}`);

export const register = (email: string, password: string, c_password: string) =>
  apiClient.post('/register', { email, password, c_password });

export const getAccountByEmail = (email: string) => apiClient.get(`/account/${email}`);

export const saveUserInfo = (payload: SaveUserInfoPayload) => apiClient.post('/users', payload);

export const verifyCode = (payload: VerifyCodePayload) => apiClient.post('/verify', payload);

export const getAccountsByEmail = (email: string) => apiClient.get(`/account?email=${email}`);

export const resendCode = (accountId: string | number) => apiClient.post(`/resend/${accountId}`);

export const getCurrentUser = () => apiClient.get<CurrentUser>('/user');

export const updateProfile = (payload: UpdateProfilePayload) => apiClient.put<CurrentUser>('/user', payload);

export const forgotPassword = (email: string) => apiClient.post('/forgot-password', { email });

export const resetPassword = (payload: {
  email: string;
  otp: string;
  password: string;
  c_password: string;
}) => apiClient.post('/reset-password', payload);

export const changePassword = (payload: {
  currentPassword: string;
  newPassword: string;
  c_password: string;
}) => apiClient.post('/change-password', payload);
