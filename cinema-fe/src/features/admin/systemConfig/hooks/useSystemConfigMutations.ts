import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SystemSettingKey } from '@/types/entities';
import { resetSystemConfig, updateSystemConfig, type UpdateSystemConfigPayload } from '../api/systemConfig.api';
import { systemConfigQueryKey } from './useSystemConfig';

type QC = ReturnType<typeof useQueryClient>;
const invalidate = (qc: QC) => qc.invalidateQueries({ queryKey: systemConfigQueryKey });

export function useUpdateSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ...payload }: UpdateSystemConfigPayload & { key: SystemSettingKey }) =>
      updateSystemConfig(key, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useResetSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, branchId }: { key: SystemSettingKey; branchId?: number | string }) =>
      resetSystemConfig(key, branchId),
    onSuccess: () => invalidate(qc),
  });
}
