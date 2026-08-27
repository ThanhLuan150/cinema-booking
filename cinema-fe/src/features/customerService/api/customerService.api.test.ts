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

import * as customerServiceApi from './customerService.api';

describe('customerService.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getSupportTickets gets /support-tickets with branchId and params', async () => {
    await customerServiceApi.getSupportTickets(1, { page: 1, status: 'OPEN' });
    expect(getMock).toHaveBeenCalledWith('/support-tickets', { params: { branchId: 1, page: 1, status: 'OPEN' } });
  });

  it('createSupportTicket posts /support-tickets', async () => {
    const payload = { branch_id: 1, customer_id: 10, subject: 'Help' };
    await customerServiceApi.createSupportTicket(payload);
    expect(postMock).toHaveBeenCalledWith('/support-tickets', payload);
  });

  it('updateSupportTicket puts /support-tickets/:id', async () => {
    await customerServiceApi.updateSupportTicket(1, { subject: 'New' });
    expect(putMock).toHaveBeenCalledWith('/support-tickets/1', { subject: 'New' });
  });

  it('claimSupportTicket posts /support-tickets/:id/claim', async () => {
    await customerServiceApi.claimSupportTicket(1);
    expect(postMock).toHaveBeenCalledWith('/support-tickets/1/claim');
  });

  it('assignSupportTicket posts /support-tickets/:id/assign', async () => {
    await customerServiceApi.assignSupportTicket(1, { employee_id: 5 });
    expect(postMock).toHaveBeenCalledWith('/support-tickets/1/assign', { employee_id: 5 });
  });

  it('resolveSupportTicket posts /support-tickets/:id/resolve', async () => {
    await customerServiceApi.resolveSupportTicket(1, { resolution_note: 'Fixed' });
    expect(postMock).toHaveBeenCalledWith('/support-tickets/1/resolve', { resolution_note: 'Fixed' });
  });

  it('closeSupportTicket posts /support-tickets/:id/close', async () => {
    await customerServiceApi.closeSupportTicket(1);
    expect(postMock).toHaveBeenCalledWith('/support-tickets/1/close');
  });

  it('deleteSupportTicket deletes /support-tickets/:id', async () => {
    await customerServiceApi.deleteSupportTicket(1);
    expect(deleteMock).toHaveBeenCalledWith('/support-tickets/1');
  });
});
