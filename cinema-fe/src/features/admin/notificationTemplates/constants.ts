import type { NotificationTemplateFilters } from './api/notificationTemplates.api';
import type { TemplateForm } from './types/notificationTemplates.types';

export function eventLabel(t: (key: string, opts?: Record<string, unknown>) => string, event: string): string {
  return t(`notificationTemplates.events.${event}`, { defaultValue: event.replace(/_/g, ' ') });
}

export const emptyFilters: NotificationTemplateFilters = { event: '', channel: '', language: '', status: '' };

export const emptyForm: TemplateForm = {
  event: '',
  channel: '',
  language: 'vi',
  subject: '',
  content: '',
  status: 'ACTIVE',
  description: '',
};
