import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type { Integration, IntegrationStatus, IntegrationType, Webhook, WebhookStatus } from '@/types/entities';

/* ------------------------------- Integrations ------------------------------- */

export interface IntegrationFilters {
  type?: IntegrationType | '';
  status?: IntegrationStatus | '';
}

export interface IntegrationPayload {
  name: string;
  provider: string;
  type: IntegrationType;
  status?: IntegrationStatus;
  config?: Record<string, unknown>;
  secret_env_var?: string | null;
  description?: string;
}

export const getIntegrations = (params?: PaginationParams & IntegrationFilters) =>
  apiClient.get<PaginatedResponse<Integration>>('/integrations', { params }).then((res) => res.data);

export const createIntegration = (payload: IntegrationPayload) =>
  apiClient.post<Integration>('/integrations', payload).then((res) => res.data);

export const updateIntegration = (id: number | string, payload: Partial<IntegrationPayload>) =>
  apiClient.put<Integration>(`/integrations/${id}`, payload).then((res) => res.data);

export const deleteIntegration = (id: number | string) => apiClient.delete(`/integrations/${id}`);

/* --------------------------------- Webhooks --------------------------------- */

export interface WebhookFilters {
  provider?: string;
  status?: WebhookStatus | '';
}

export const getWebhooks = (params?: PaginationParams & WebhookFilters) =>
  apiClient.get<PaginatedResponse<Webhook>>('/webhooks', { params }).then((res) => res.data);

export const retryWebhook = (id: number | string) =>
  apiClient.post<Webhook>(`/webhooks/${id}/retry`).then((res) => res.data);
