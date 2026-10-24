import apiClient from 'services/apiClient';
import type { PaginatedResponse } from '@/types/pagination';
import type {
  LoyaltyConfig,
  MembershipBenefits,
  MembershipLevel,
  MembershipPreview,
  MembershipPreviewPayload,
  MembershipSummary,
  MyMembership,
  PointsTransaction,
  PointsTransactionListParams,
  PurchaseSubscriptionResult,
  RedeemPointsResult,
  SaleAccess,
  Subscription,
  SubscriptionConfirmResult,
  SubscriptionListParams,
  SubscriptionPlan,
  SubscriptionPlanInput,
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
  updates: Partial<Pick<MembershipLevel, 'name' | 'min_points' | 'active'>> & { benefits?: Partial<MembershipBenefits> },
) => apiClient.put<MembershipLevel>(`/membership-levels/${id}`, updates).then((res) => res.data);

// --- Membership & Subscription (Ticket 53) -------------------------------------------------------

export const getMyMembershipDetails = () => apiClient.get<MyMembership>('/membership/me').then((res) => res.data);

export const previewMembership = (payload: MembershipPreviewPayload) =>
  apiClient.post<MembershipPreview>('/membership/me/preview', payload).then((res) => res.data);

export const getSaleAccess = (scheduleId: number | string) =>
  apiClient.get<SaleAccess>(`/membership/me/sale-access/${scheduleId}`).then((res) => res.data);

export const getSubscriptionPlans = () => apiClient.get<SubscriptionPlan[]>('/subscription-plans').then((res) => res.data);

export const purchaseSubscription = (planId: number, idempotencyKey?: string) =>
  apiClient
    .post<PurchaseSubscriptionResult>(
      '/subscriptions',
      { plan_id: planId },
      { headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined },
    )
    .then((res) => res.data);

export const getMySubscriptions = (params?: SubscriptionListParams) =>
  apiClient.get<PaginatedResponse<Subscription>>('/subscriptions/me', { params }).then((res) => res.data);

export const cancelMySubscription = (code: string) =>
  apiClient.post<Subscription>(`/subscriptions/me/${encodeURIComponent(code)}/cancel`).then((res) => res.data);

// Called from the MoMo result page with the query params MoMo redirected back with.
export const confirmSubscriptionPayment = (code: string, params: Record<string, string>) =>
  apiClient
    .post<SubscriptionConfirmResult>(`/subscriptions/me/${encodeURIComponent(code)}/momo-confirm`, params)
    .then((res) => res.data);

// --- Super Admin ---------------------------------------------------------------------------------

export const getAllSubscriptionPlans = () =>
  apiClient.get<SubscriptionPlan[]>('/subscription-plans/all').then((res) => res.data);

export const createSubscriptionPlan = (payload: SubscriptionPlanInput) =>
  apiClient.post<SubscriptionPlan>('/subscription-plans', payload).then((res) => res.data);

export const updateSubscriptionPlan = (id: number, payload: Omit<SubscriptionPlanInput, 'code'>) =>
  apiClient.put<SubscriptionPlan>(`/subscription-plans/${id}`, payload).then((res) => res.data);

export const deleteSubscriptionPlan = (id: number) =>
  apiClient.delete(`/subscription-plans/${id}`).then((res) => res.data);

export const getAllSubscriptions = (params?: SubscriptionListParams) =>
  apiClient.get<PaginatedResponse<Subscription>>('/subscriptions', { params }).then((res) => res.data);

export const revokeSubscription = (id: number, reason?: string) =>
  apiClient.post<Subscription>(`/subscriptions/${id}/cancel`, { reason }).then((res) => res.data);

export const deleteMembershipLevel = (id: number | string) =>
  apiClient.delete(`/membership-levels/${id}`).then((res) => res.data);
