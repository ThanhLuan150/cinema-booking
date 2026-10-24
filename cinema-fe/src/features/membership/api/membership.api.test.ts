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

import * as api from './membership.api';

describe('membership.api — Ticket 53', () => {
  beforeEach(() => {
    for (const mock of [getMock, postMock, putMock, deleteMock]) {
      mock.mockReset();
      mock.mockResolvedValue({ data: { ok: true } });
    }
  });

  it("reads the caller's own membership, with no account id in the request", async () => {
    await api.getMyMembershipDetails();
    expect(getMock).toHaveBeenCalledWith('/membership/me');
  });

  it('asks for a preview with only ids and a free-ticket count', async () => {
    await api.previewMembership({ ticketIds: [1, 2], comboIds: [3], freeTickets: 1 });
    expect(postMock).toHaveBeenCalledWith('/membership/me/preview', { ticketIds: [1, 2], comboIds: [3], freeTickets: 1 });
  });

  it('buys a plan by its id only, carrying the Idempotency-Key', async () => {
    await api.purchaseSubscription(4, 'key-1');
    expect(postMock).toHaveBeenCalledWith('/subscriptions', { plan_id: 4 }, { headers: { 'Idempotency-Key': 'key-1' } });
    await api.purchaseSubscription(4);
    expect(postMock).toHaveBeenLastCalledWith('/subscriptions', { plan_id: 4 }, { headers: undefined });
  });

  it('confirms, cancels and lists only the caller’s own subscriptions', async () => {
    await api.confirmSubscriptionPayment('SUB-9', { orderId: 'SUB-9', resultCode: '0' });
    expect(postMock).toHaveBeenCalledWith('/subscriptions/me/SUB-9/momo-confirm', { orderId: 'SUB-9', resultCode: '0' });
    await api.cancelMySubscription('SUB-9');
    expect(postMock).toHaveBeenLastCalledWith('/subscriptions/me/SUB-9/cancel');
    await api.getMySubscriptions({ limit: 10 });
    expect(getMock).toHaveBeenCalledWith('/subscriptions/me', { params: { limit: 10 } });
  });

  it('manages plans and subscriptions through the admin endpoints', async () => {
    await api.getAllSubscriptionPlans();
    expect(getMock).toHaveBeenCalledWith('/subscription-plans/all');
    await api.deleteSubscriptionPlan(2);
    expect(deleteMock).toHaveBeenCalledWith('/subscription-plans/2');
    await api.revokeSubscription(7, 'Fraud');
    expect(postMock).toHaveBeenCalledWith('/subscriptions/7/cancel', { reason: 'Fraud' });
    await api.updateMembershipLevel(3, { benefits: { free_tickets: 2 } });
    expect(putMock).toHaveBeenCalledWith('/membership-levels/3', { benefits: { free_tickets: 2 } });
  });
});
