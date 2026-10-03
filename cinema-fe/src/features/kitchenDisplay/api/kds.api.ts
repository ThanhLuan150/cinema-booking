import apiClient from 'services/apiClient';
import type {
  KdsBoard,
  KdsBranch,
  KdsBoardParams,
  KdsOrder,
  UpdateKdsStatusPayload,
} from '../types/kds.types';

// The branches the caller may open on the KDS (all of them for the Super Admin), with waiting counts.
export const getKdsBranches = () =>
  apiClient.get<KdsBranch[]>('/kds/branches').then((res) => res.data);

// Every KDS call is pinned to one branch in the URL; the server refuses any order of another branch.
export const getKdsBoard = (branchId: number, params: KdsBoardParams = {}) =>
  apiClient
    .get<KdsBoard>(`/kds/branches/${branchId}/orders`, {
      params: {
        status: params.status?.length ? params.status.join(',') : undefined,
        recentMinutes: params.recentMinutes,
      },
    })
    .then((res) => res.data);

// Only { status, reason } ever travels — the endpoint rejects anything else (prices included).
export const updateKdsStatus = (
  branchId: number,
  orderId: number,
  payload: UpdateKdsStatusPayload,
) =>
  apiClient
    .patch<KdsOrder>(`/kds/branches/${branchId}/orders/${orderId}/status`, {
      status: payload.status,
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
    })
    .then((res) => res.data);
