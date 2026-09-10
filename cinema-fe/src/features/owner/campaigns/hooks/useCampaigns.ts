import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getCampaign, getCampaignMeta, getCampaigns, type CampaignListParams } from '../api/campaign.api';

export const campaignsQueryKey = ['ownerCampaigns'] as const;
export const campaignMetaQueryKey = ['ownerCampaignMeta'] as const;

export function useCampaigns(params: CampaignListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...campaignsQueryKey, params],
    queryFn: () => getCampaigns(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useCampaign(id: number | string | undefined, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...campaignsQueryKey, 'detail', id],
    queryFn: () => getCampaign(id as number),
    enabled: (options?.enabled ?? true) && id !== undefined && id !== '',
  });
}

export function useCampaignMeta() {
  return useQuery({
    queryKey: campaignMetaQueryKey,
    queryFn: getCampaignMeta,
    staleTime: 5 * 60 * 1000,
  });
}
