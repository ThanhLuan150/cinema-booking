import { describe, expect, it, vi, beforeEach } from 'vitest';

const getMock = vi.fn();
const postMock = vi.fn();
const putMock = vi.fn();
const deleteMock = vi.fn();
vi.mock('services/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
  },
}));

import * as integrationsApi from './integrations.api';

describe('integrations.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
    postMock.mockResolvedValue({ data: {} });
  });

  it('getIntegrations gets /integrations with params', async () => {
    await integrationsApi.getIntegrations({ page: 1, type: 'PAYMENT_GATEWAY' });
    expect(getMock).toHaveBeenCalledWith('/integrations', { params: { page: 1, type: 'PAYMENT_GATEWAY' } });
  });

  it('createIntegration posts /integrations and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { id: 1, provider: 'MOMO' } });
    const res = await integrationsApi.createIntegration({ name: 'MoMo', provider: 'MOMO', type: 'PAYMENT_GATEWAY' });
    expect(postMock).toHaveBeenCalledWith('/integrations', { name: 'MoMo', provider: 'MOMO', type: 'PAYMENT_GATEWAY' });
    expect(res.id).toBe(1);
  });

  it('updateIntegration puts /integrations/:id', async () => {
    putMock.mockResolvedValue({ data: { id: 1, status: 'INACTIVE' } });
    await integrationsApi.updateIntegration(1, { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith('/integrations/1', { status: 'INACTIVE' });
  });

  it('deleteIntegration deletes /integrations/:id', async () => {
    await integrationsApi.deleteIntegration(1);
    expect(deleteMock).toHaveBeenCalledWith('/integrations/1');
  });

  it('getWebhooks gets /webhooks with params', async () => {
    await integrationsApi.getWebhooks({ page: 1, status: 'FAILED' });
    expect(getMock).toHaveBeenCalledWith('/webhooks', { params: { page: 1, status: 'FAILED' } });
  });

  it('retryWebhook posts /webhooks/:id/retry and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { id: 2, status: 'SUCCESS' } });
    const res = await integrationsApi.retryWebhook(2);
    expect(postMock).toHaveBeenCalledWith('/webhooks/2/retry');
    expect(res.status).toBe('SUCCESS');
  });
});
