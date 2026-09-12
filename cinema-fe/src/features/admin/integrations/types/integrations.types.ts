import type { IntegrationType } from '@/types/entities';

export type Tab = 'integrations' | 'webhooks';

export interface IntegrationForm {
  name: string;
  provider: string;
  type: IntegrationType;
  status: 'ACTIVE' | 'INACTIVE';
  secret_env_var: string;
  description: string;
}
