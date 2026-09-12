import type { ScreenStatus, SignageContentStatus, SignageContentType } from '@/types/entities';
import type { ContentForm, EntryForm, ScreenForm } from './types/signage.types';

export const ALL_BRANCHES = 'ALL';
export const SCREEN_STATUSES: ScreenStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
export const CONTENT_STATUSES: SignageContentStatus[] = ['ACTIVE', 'INACTIVE'];
export const CONTENT_TYPES: SignageContentType[] = [
  'MOVIE_POSTER',
  'SHOWTIME',
  'COMING_SOON',
  'PROMOTION',
  'ADVERTISEMENT',
  'ANNOUNCEMENT',
];

export const SCREEN_STATUS_VARIANT: Record<ScreenStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};

export const MOVIE_TYPES: SignageContentType[] = ['MOVIE_POSTER', 'COMING_SOON'];

export const DROP_LABEL: Record<string, string> = {
  CONTENT_NOT_FOUND: 'signage.drop.CONTENT_NOT_FOUND',
  CONTENT_INACTIVE: 'signage.drop.CONTENT_INACTIVE',
  CONTENT_BRANCH_MISMATCH: 'signage.drop.CONTENT_BRANCH_MISMATCH',
  SHOWTIME_NOT_FOUND: 'signage.drop.SHOWTIME_NOT_FOUND',
  SHOWTIME_BRANCH_MISMATCH: 'signage.drop.SHOWTIME_BRANCH_MISMATCH',
  SHOWTIME_CANCELLED: 'signage.drop.SHOWTIME_CANCELLED',
};

export const emptyScreenForm: ScreenForm = { name: '', location: '', device_id: '', status: 'ACTIVE' };

export const emptyContentForm: ContentForm = {
  type: 'ANNOUNCEMENT',
  title: '',
  body: '',
  image_url: '',
  movie_id: '',
  schedule_id: '',
  promotion_id: '',
  status: 'ACTIVE',
};

export const emptyEntryForm: EntryForm = { content_id: '', start_at: '', end_at: '', priority: '0', status: 'ACTIVE' };
