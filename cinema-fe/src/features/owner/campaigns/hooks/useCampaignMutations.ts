import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCampaign,
  createCampaignBanner,
  deleteCampaign,
  deleteCampaignBanner,
  notifyCampaign,
  updateCampaign,
  updateCampaignBanner,
  type CampaignBannerPayload,
  type CampaignPayload,
} from '../api/campaign.api';
import { campaignsQueryKey } from './useCampaigns';

type QC = ReturnType<typeof useQueryClient>;
const invalidate = (qc: QC) => qc.invalidateQueries({ queryKey: campaignsQueryKey });

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CampaignPayload) => createCampaign(payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: CampaignPayload & { id: number | string }) => updateCampaign(id, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteCampaign(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useNotifyCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => notifyCampaign(id),
    onSuccess: () => invalidate(qc),
  });
}

export function useCreateCampaignBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ campaignId, ...payload }: CampaignBannerPayload & { campaignId: number | string }) =>
      createCampaignBanner(campaignId, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateCampaignBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bannerId, ...payload }: CampaignBannerPayload & { bannerId: number | string }) =>
      updateCampaignBanner(bannerId, payload),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCampaignBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bannerId: number | string) => deleteCampaignBanner(bannerId),
    onSuccess: () => invalidate(qc),
  });
}
