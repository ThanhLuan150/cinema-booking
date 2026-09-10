import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  Campaign,
  CampaignBanner,
  CampaignBannerPlacement,
  CampaignBannerStatus,
  CampaignDetail,
  CampaignDisplayState,
  CampaignMeta,
  CampaignNotifyResult,
  CampaignStatus,
  CampaignTargetType,
  PublicCampaign,
} from '@/types/entities';

// ---- Campaigns ------------------------------------------------------------

export interface CampaignListParams extends PaginationParams {
  branchId?: number | string;
  global?: boolean;
  status?: CampaignStatus;
  targetType?: CampaignTargetType;
  state?: CampaignDisplayState;
}

export const getCampaigns = (params: CampaignListParams) =>
  apiClient.get<PaginatedResponse<Campaign>>('/campaigns', { params }).then((res) => res.data);

export const getCampaign = (id: number | string) =>
  apiClient.get<CampaignDetail>(`/campaigns/${id}`).then((res) => res.data);

export const getCampaignMeta = () =>
  apiClient.get<CampaignMeta>('/campaigns/meta').then((res) => res.data);

export interface CampaignPayload {
  name?: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  status?: CampaignStatus;
  target_type?: CampaignTargetType;
  branch_id?: number | null;
  movie_ids?: number[];
  promotion_ids?: number[];
  notification_enabled?: boolean;
  notification_title?: string;
  notification_body?: string;
}

export const createCampaign = (payload: CampaignPayload) =>
  apiClient.post<Campaign>('/campaigns', payload).then((res) => res.data);

export const updateCampaign = (id: number | string, payload: CampaignPayload) =>
  apiClient.put<Campaign>(`/campaigns/${id}`, payload).then((res) => res.data);

export const deleteCampaign = (id: number | string) => apiClient.delete(`/campaigns/${id}`);

export const notifyCampaign = (id: number | string) =>
  apiClient.post<CampaignNotifyResult>(`/campaigns/${id}/notify`).then((res) => res.data);

// ---- Banners -----------------------------------------------------------------

export interface CampaignBannerPayload {
  title?: string;
  subtitle?: string;
  image_url?: string;
  link_url?: string;
  placement?: CampaignBannerPlacement;
  sort_order?: number;
  status?: CampaignBannerStatus;
}

export const getCampaignBanners = (campaignId: number | string) =>
  apiClient.get<{ data: CampaignBanner[] }>(`/campaigns/${campaignId}/banners`).then((res) => res.data.data);

export const createCampaignBanner = (campaignId: number | string, payload: CampaignBannerPayload) =>
  apiClient.post<CampaignBanner>(`/campaigns/${campaignId}/banners`, payload).then((res) => res.data);

export const updateCampaignBanner = (bannerId: number | string, payload: CampaignBannerPayload) =>
  apiClient.put<CampaignBanner>(`/campaigns/banners/${bannerId}`, payload).then((res) => res.data);

export const deleteCampaignBanner = (bannerId: number | string) =>
  apiClient.delete(`/campaigns/banners/${bannerId}`);

// ---- Public (unauthenticated) ---------------------------------------------

export const getPublicCampaigns = (params?: { branchId?: number | string; placement?: CampaignBannerPlacement }) =>
  apiClient.get<{ data: PublicCampaign[] }>('/campaigns/public', { params }).then((res) => res.data.data);
