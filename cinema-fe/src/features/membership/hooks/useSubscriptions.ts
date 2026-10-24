import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsAuthenticated } from '@/features/auth/hooks/useAuth';
import {
  cancelMySubscription,
  confirmSubscriptionPayment,
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  getAllSubscriptionPlans,
  getAllSubscriptions,
  getMyMembershipDetails,
  getMySubscriptions,
  getSaleAccess,
  getSubscriptionPlans,
  previewMembership,
  purchaseSubscription,
  revokeSubscription,
  updateMembershipLevel,
  updateSubscriptionPlan,
} from '../api/membership.api';
import type {
  MembershipBenefits,
  MembershipPreviewPayload,
  SubscriptionListParams,
  SubscriptionPlanInput,
} from '../types/membership.types';
import { myMembershipQueryKey } from './useMyMembership';
import { membershipLevelsQueryKey } from './useMembershipLevels';

// Everything Ticket 53 caches lives under one root, so a realtime nudge can drop it in one go.
export const membershipKeys = {
  all: ['membership'] as const,
  details: ['membership', 'me'] as const,
  preview: (payload: MembershipPreviewPayload) => ['membership', 'preview', payload] as const,
  saleAccess: (scheduleId: number | null) => ['membership', 'saleAccess', scheduleId] as const,
  plans: ['membership', 'plans'] as const,
  mySubscriptions: (params: SubscriptionListParams) => ['membership', 'mySubscriptions', params] as const,
  adminPlans: ['membership', 'admin', 'plans'] as const,
  adminSubscriptions: (params: SubscriptionListParams) => ['membership', 'admin', 'subscriptions', params] as const,
};

export function useMembershipDetails() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({ queryKey: membershipKeys.details, queryFn: getMyMembershipDetails, enabled: isAuthenticated });
}

// The seat page's live server quote. Never used to charge anything — the checkout prices again.
export function useMembershipPreview(payload: MembershipPreviewPayload, enabled: boolean) {
  return useQuery({
    queryKey: membershipKeys.preview(payload),
    queryFn: () => previewMembership(payload),
    enabled: enabled && payload.ticketIds.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useSaleAccess(scheduleId: number | null) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: membershipKeys.saleAccess(scheduleId),
    queryFn: () => getSaleAccess(scheduleId as number),
    enabled: isAuthenticated && scheduleId !== null,
    staleTime: 60 * 1000,
  });
}

export function useSubscriptionPlans() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({ queryKey: membershipKeys.plans, queryFn: getSubscriptionPlans, enabled: isAuthenticated });
}

export function useMySubscriptions(params: SubscriptionListParams = {}) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: membershipKeys.mySubscriptions(params),
    queryFn: () => getMySubscriptions(params),
    enabled: isAuthenticated,
    placeholderData: keepPreviousData,
  });
}

function useInvalidateMembership() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: membershipKeys.all });
    queryClient.invalidateQueries({ queryKey: myMembershipQueryKey });
  };
}

export function usePurchaseSubscription() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: ({ planId, idempotencyKey }: { planId: number; idempotencyKey?: string }) =>
      purchaseSubscription(planId, idempotencyKey),
    onSuccess: invalidate,
  });
}

export function useCancelMySubscription() {
  const invalidate = useInvalidateMembership();
  return useMutation({ mutationFn: (code: string) => cancelMySubscription(code), onSuccess: invalidate });
}

export function useConfirmSubscriptionPayment() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: ({ code, params }: { code: string; params: Record<string, string> }) => confirmSubscriptionPayment(code, params),
    onSettled: invalidate,
  });
}

// --- Super Admin ---------------------------------------------------------------------------------

export function useAllSubscriptionPlans() {
  return useQuery({ queryKey: membershipKeys.adminPlans, queryFn: getAllSubscriptionPlans });
}

export function useAllSubscriptions(params: SubscriptionListParams) {
  return useQuery({
    queryKey: membershipKeys.adminSubscriptions(params),
    queryFn: () => getAllSubscriptions(params),
    placeholderData: keepPreviousData,
  });
}

export function useSaveSubscriptionPlan() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | null; payload: SubscriptionPlanInput }) => {
      if (id === null) return createSubscriptionPlan(payload);
      const { code: _code, ...rest } = payload;
      return updateSubscriptionPlan(id, rest);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSubscriptionPlan() {
  const invalidate = useInvalidateMembership();
  return useMutation({ mutationFn: (id: number) => deleteSubscriptionPlan(id), onSuccess: invalidate });
}

export function useRevokeSubscription() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => revokeSubscription(id, reason),
    onSuccess: invalidate,
  });
}

export function useUpdateTierBenefits() {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: ({ id, min_points, benefits }: { id: number; min_points?: number; benefits: Partial<MembershipBenefits> }) =>
      updateMembershipLevel(id, { min_points, benefits }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: membershipLevelsQueryKey });
    },
  });
}
