import type {
  CampaignBannerPlacement,
  CampaignDisplayState,
  CampaignStatus,
  CampaignTargetType,
} from '@/types/entities';
import type { BannerForm, CampaignForm } from './types/campaigns.types';

export const ALL_BRANCHES = 'ALL';
export const GLOBAL = 'GLOBAL';
export const STATUSES: CampaignStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED'];
export const TARGET_TYPES: CampaignTargetType[] = ['ALL_CUSTOMERS', 'MEMBERS', 'BRANCH_CUSTOMERS'];
export const STATES: CampaignDisplayState[] = ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'EXPIRED', 'ARCHIVED'];
export const BANNER_PLACEMENTS: CampaignBannerPlacement[] = ['HOME_HERO', 'HOME_STRIP', 'MOVIE_DETAIL', 'BOOKING'];

export const STATE_VARIANT: Record<CampaignDisplayState, 'success' | 'default' | 'warning' | 'outline'> = {
  RUNNING: 'success',
  SCHEDULED: 'warning',
  PAUSED: 'warning',
  DRAFT: 'default',
  EXPIRED: 'outline',
  ARCHIVED: 'default',
};

export const emptyForm: CampaignForm = {
  name: '',
  description: '',
  start_at: '',
  end_at: '',
  status: 'DRAFT',
  target_type: 'ALL_CUSTOMERS',
  movie_ids: [],
  promotion_ids: [],
  notification_enabled: false,
  notification_title: '',
  notification_body: '',
};

export const emptyBannerForm: BannerForm = {
  title: '',
  subtitle: '',
  image_url: '',
  link_url: '',
  placement: 'HOME_STRIP',
  sort_order: '0',
  status: 'ACTIVE',
};
