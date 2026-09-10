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

import * as api from './privateEvents.api';

describe('privateEvents.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: { data: [] } });
    postMock.mockResolvedValue({ data: {} });
  });

  it('getEventPackages gets /private-events/packages', async () => {
    await api.getEventPackages({ status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/private-events/packages', { params: { status: 'ACTIVE' } });
  });

  it('requestPrivateEvent posts /private-events and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { id: 5, status: 'REQUESTED' } });
    const res = await api.requestPrivateEvent({
      branch_id: 1,
      room_id: 2,
      package_id: 3,
      start_at: 'a',
      end_at: 'b',
      guest_count: 10,
    });
    expect(postMock).toHaveBeenCalledWith('/private-events', expect.objectContaining({ branch_id: 1, room_id: 2 }));
    expect(res.id).toBe(5);
  });

  it('getMyPrivateEvents gets /private-events/mine', async () => {
    await api.getMyPrivateEvents({ page: 2 });
    expect(getMock).toHaveBeenCalledWith('/private-events/mine', { params: { page: 2 } });
  });

  it('customer actions hit the right endpoints', async () => {
    await api.payPrivateEvent(7);
    expect(postMock).toHaveBeenCalledWith('/private-events/7/pay');
    await api.cancelMyPrivateEvent(7, 'nope');
    expect(postMock).toHaveBeenCalledWith('/private-events/7/cancel', { reason: 'nope' });
  });

  it('admin list scopes by branchId', async () => {
    await api.getPrivateEvents(3, { status: 'REQUESTED' });
    expect(getMock).toHaveBeenCalledWith('/private-events', { params: { branchId: 3, status: 'REQUESTED' } });
  });

  it('admin review actions hit the right endpoints', async () => {
    await api.quotePrivateEvent(9, 500, 'incl. cleaning');
    expect(postMock).toHaveBeenCalledWith('/private-events/9/quote', { quoted_amount: 500, quote_notes: 'incl. cleaning' });
    await api.approvePrivateEvent(9);
    expect(postMock).toHaveBeenCalledWith('/private-events/9/approve');
    await api.confirmPrivateEvent(9);
    expect(postMock).toHaveBeenCalledWith('/private-events/9/confirm');
    await api.completePrivateEvent(9);
    expect(postMock).toHaveBeenCalledWith('/private-events/9/complete');
    await api.rejectPrivateEvent(9, 'dup');
    expect(postMock).toHaveBeenCalledWith('/private-events/9/reject', { reason: 'dup' });
  });

  it('package CRUD targets /private-events/packages', async () => {
    postMock.mockResolvedValue({ data: { id: 1 } });
    await api.createEventPackage({ name: 'Deluxe', code: 'DELUXE', base_price: 100 });
    expect(postMock).toHaveBeenCalledWith('/private-events/packages', { name: 'Deluxe', code: 'DELUXE', base_price: 100 });
    await api.updateEventPackage(2, { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith('/private-events/packages/2', { status: 'INACTIVE' });
    await api.deleteEventPackage(2);
    expect(deleteMock).toHaveBeenCalledWith('/private-events/packages/2');
  });
});
