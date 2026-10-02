import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { comboOrdersQueryKey } from '@/features/comboOrder/hooks/useComboOrders';
import { getKdsBoard, getKdsBranches, updateKdsStatus } from '../api/kds.api';
import type { KdsBoardParams, UpdateKdsStatusPayload } from '../types/kds.types';

export const kdsBoardQueryKey = ['kdsBoard'] as const;

// Live updates arrive over the socket (comboOrder:updated -> RealtimeBridge invalidates this key);
// the interval is only the safety net for a dropped connection.
export const KDS_POLL_INTERVAL_MS = 30_000;

export function useKdsBoard(branchId: number | null, params: KdsBoardParams = {}) {
  return useQuery({
    queryKey: [...kdsBoardQueryKey, branchId, params],
    queryFn: () => getKdsBoard(branchId as number, params),
    enabled: branchId !== null,
    refetchInterval: KDS_POLL_INTERVAL_MS,
  });
}

// Under the board key, so the same realtime invalidation keeps the waiting counts fresh.
export function useKdsBranches(enabled = true) {
  return useQuery({
    queryKey: [...kdsBoardQueryKey, 'branches'],
    queryFn: getKdsBranches,
    enabled,
    refetchInterval: KDS_POLL_INTERVAL_MS,
  });
}

export function useUpdateKdsStatus(branchId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...payload }: UpdateKdsStatusPayload & { orderId: number }) =>
      updateKdsStatus(branchId as number, orderId, payload),
    onSettled: () => {
      // A 409 (someone else moved it first) also means our copy is stale.
      queryClient.invalidateQueries({ queryKey: kdsBoardQueryKey });
      queryClient.invalidateQueries({ queryKey: comboOrdersQueryKey });
    },
  });
}
