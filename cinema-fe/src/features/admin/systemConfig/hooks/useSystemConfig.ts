import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getSystemConfigList, getSystemConfigMeta, type SystemConfigListParams } from '../api/systemConfig.api';

export const systemConfigQueryKey = ['systemConfig'] as const;
export const systemConfigMetaQueryKey = ['systemConfigMeta'] as const;

export function useSystemConfigList(params: SystemConfigListParams = {}) {
  return useQuery({
    queryKey: [...systemConfigQueryKey, params],
    queryFn: () => getSystemConfigList(params),
    placeholderData: keepPreviousData,
  });
}

export function useSystemConfigMeta() {
  return useQuery({
    queryKey: systemConfigMetaQueryKey,
    queryFn: getSystemConfigMeta,
    staleTime: 5 * 60 * 1000,
  });
}
