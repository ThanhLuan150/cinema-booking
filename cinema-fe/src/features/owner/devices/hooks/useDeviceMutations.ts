import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createDevice,
  createEntrance,
  deleteDevice,
  deleteEntrance,
  rotateDeviceKey,
  updateDevice,
  updateEntrance,
  type CreateDevicePayload,
  type EntrancePayload,
  type UpdateDevicePayload,
} from '../api/devices.api';
import { devicesQueryKey } from './useDevices';
import { entrancesQueryKey } from './useEntrances';

type QC = ReturnType<typeof useQueryClient>;
const invalidateDevices = (qc: QC) => qc.invalidateQueries({ queryKey: devicesQueryKey });
const invalidateEntrances = (qc: QC) => qc.invalidateQueries({ queryKey: entrancesQueryKey });

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDevicePayload) => createDevice(payload),
    onSuccess: () => invalidateDevices(qc),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateDevicePayload & { id: number | string }) => updateDevice(id, payload),
    onSuccess: () => invalidateDevices(qc),
  });
}

export function useRotateDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => rotateDeviceKey(id),
    onSuccess: () => invalidateDevices(qc),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteDevice(id),
    onSuccess: () => invalidateDevices(qc),
  });
}

export function useCreateEntrance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EntrancePayload) => createEntrance(payload),
    onSuccess: () => invalidateEntrances(qc),
  });
}

export function useUpdateEntrance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: EntrancePayload & { id: number | string }) => updateEntrance(id, payload),
    onSuccess: () => invalidateEntrances(qc),
  });
}

export function useDeleteEntrance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteEntrance(id),
    onSuccess: () => {
      invalidateEntrances(qc);
      invalidateDevices(qc);
    },
  });
}
