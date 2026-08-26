import apiClient from 'services/apiClient';
import type { PaginatedResponse } from '@/types/pagination';
import type {
  LoyaltyConfig,
  MembershipLevel,
  MembershipSummary,
  PointsTransaction,
  PointsTransactionListParams,
  RedeemPointsResult,
} from '../types/membership.types';

export const getMySummary = () => apiClient.get<MembershipSummary>('/loyalty/me').then((res) => res.data);

export const getMyPointsHistory = (params?: PointsTransactionListParams) =>
  apiClient.get<PaginatedResponse<PointsTransaction>>('/loyalty/me/transactions', { params }).then((res) => res.data);

export const redeemPoints = (points: number, description?: string) =>
  apiClient.post<RedeemPointsResult>('/loyalty/redeem', { points, description }).then((res) => res.data);

export const getMembershipLevels = () => apiClient.get<MembershipLevel[]>('/membership-levels').then((res) => res.data);

export const getLoyaltyConfig = () => apiClient.get<LoyaltyConfig>('/loyalty/config').then((res) => res.data);

export const updateLoyaltyConfig = (updates: Partial<LoyaltyConfig>) =>
  apiClient.put<LoyaltyConfig>('/loyalty/config', updates).then((res) => res.data);

export const createMembershipLevel = (payload: { code: string; name: string; min_points: number; active?: boolean }) =>
  apiClient.post<MembershipLevel>('/membership-levels', payload).then((res) => res.data);

export const updateMembershipLevel = (
  id: number | string,
  updates: Partial<Pick<MembershipLevel, 'name' | 'min_points' | 'active'>>,
) => apiClient.put<MembershipLevel>(`/membership-levels/${id}`, updates).then((res) => res.data);

export const deleteMembershipLevel = (id: number | string) =>
  apiClient.delete(`/membership-levels/${id}`).then((res) => res.data);
