import type {
  NotificationTemplateChannel,
  NotificationTemplateEvent,
  NotificationTemplateStatus,
} from '@/types/entities';

export interface TemplateForm {
  event: NotificationTemplateEvent | '';
  channel: NotificationTemplateChannel | '';
  language: string;
  subject: string;
  content: string;
  status: NotificationTemplateStatus;
  description: string;
}
