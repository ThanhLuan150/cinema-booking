import type { CampaignBannerPlacement, CampaignStatus, CampaignTargetType } from '@/types/entities';

export interface CampaignForm {
  name: string;
  description: string;
  start_at: string;
  end_at: string;
  status: CampaignStatus;
  target_type: CampaignTargetType;
  movie_ids: number[];
  promotion_ids: number[];
  notification_enabled: boolean;
  notification_title: string;
  notification_body: string;
}

export interface BannerForm {
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  placement: CampaignBannerPlacement;
  sort_order: string;
  status: 'ACTIVE' | 'INACTIVE';
}
