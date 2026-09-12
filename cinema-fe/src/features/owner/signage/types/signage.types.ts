import type { ScreenStatus, SignageContentStatus, SignageContentType } from '@/types/entities';

export interface ScreenForm {
  name: string;
  location: string;
  device_id: string;
  status: ScreenStatus;
}

export interface ContentForm {
  type: SignageContentType;
  title: string;
  body: string;
  image_url: string;
  movie_id: string;
  schedule_id: string;
  promotion_id: string;
  status: SignageContentStatus;
}

export interface EntryForm {
  content_id: string;
  start_at: string;
  end_at: string;
  priority: string;
  status: 'ACTIVE' | 'INACTIVE';
}
