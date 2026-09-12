import type { IntegrationType, WebhookStatus } from '@/types/entities';
import type { IntegrationForm } from './types/integrations.types';

export const INTEGRATION_TYPES: IntegrationType[] = [
  'PAYMENT_GATEWAY',
  'EMAIL_PROVIDER',
  'SMS_PROVIDER',
  'CLOUD_STORAGE',
  'ACCOUNTING_SYSTEM',
  'THIRD_PARTY_TICKETING',
];

export const WEBHOOK_STATUSES: WebhookStatus[] = ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'];

export const emptyIntegration: IntegrationForm = {
  name: '',
  provider: '',
  type: 'PAYMENT_GATEWAY',
  status: 'ACTIVE',
  secret_env_var: '',
  description: '',
};
