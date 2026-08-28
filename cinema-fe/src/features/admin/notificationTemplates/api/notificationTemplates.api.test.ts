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

import * as api from './notificationTemplates.api';

describe('notificationTemplates.api', () => {
  beforeEach(() => {
    getMock.mockReset().mockResolvedValue({ data: {} });
    postMock.mockReset().mockResolvedValue({ data: {} });
    putMock.mockReset().mockResolvedValue({ data: {} });
    deleteMock.mockReset().mockResolvedValue({ data: {} });
  });

  it('getNotificationTemplates gets /notification-templates with params', async () => {
    await api.getNotificationTemplates({ page: 2, limit: 10, event: 'TICKET_ISSUED', channel: 'EMAIL' });
    expect(getMock).toHaveBeenCalledWith('/notification-templates', {
      params: { page: 2, limit: 10, event: 'TICKET_ISSUED', channel: 'EMAIL' },
    });
  });

  it('getNotificationTemplateMeta gets /notification-templates/meta', async () => {
    await api.getNotificationTemplateMeta();
    expect(getMock).toHaveBeenCalledWith('/notification-templates/meta');
  });

  it('createNotificationTemplate posts the payload', async () => {
    const payload = { event: 'BOOKING_SUCCESS' as const, channel: 'IN_APP' as const, content: 'Hi {{customer_name}}' };
    await api.createNotificationTemplate(payload);
    expect(postMock).toHaveBeenCalledWith('/notification-templates', payload);
  });

  it('updateNotificationTemplate puts to /notification-templates/:id', async () => {
    await api.updateNotificationTemplate(7, { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith('/notification-templates/7', { status: 'INACTIVE' });
  });

  it('deleteNotificationTemplate deletes /notification-templates/:id', async () => {
    await api.deleteNotificationTemplate(7);
    expect(deleteMock).toHaveBeenCalledWith('/notification-templates/7');
  });

  it('previewNotificationTemplate posts to /notification-templates/preview', async () => {
    await api.previewNotificationTemplate({ subject: 'S', content: 'C {{movie_name}}' });
    expect(postMock).toHaveBeenCalledWith('/notification-templates/preview', { subject: 'S', content: 'C {{movie_name}}' });
  });
});
