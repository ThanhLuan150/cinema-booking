import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createKiosk,
  deleteKiosk,
  rotateKioskKey,
  updateKiosk,
  type CreateKioskPayload,
  type UpdateKioskPayload,
} from '../api/kiosks.api';
import { kiosksQueryKey } from './useKiosks';

type QC = ReturnType<typeof useQueryClient>;
const invalidate = (qc: QC) => qc.invalidateQueries({ queryKey: kiosksQueryKey });

export function useCreateKiosk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateKioskPayload) => createKiosk(payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateKiosk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateKioskPayload & { id: number | string }) => updateKiosk(id, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useRotateKioskKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => rotateKioskKey(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteKiosk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteKiosk(id),
    onSuccess: () => invalidate(qc),
  });
}
