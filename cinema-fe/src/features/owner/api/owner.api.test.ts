import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FULL_LIST_FETCH_LIMIT } from '@/constants/pagination';

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

import * as ownerApi from './owner.api';

describe('owner.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
  });

  it('getMyCinemas gets /cinema/mine', async () => {
    await ownerApi.getMyCinemas({ limit: 100 } as any);
    expect(getMock).toHaveBeenCalledWith('/cinema/mine', { params: { limit: 100 } });
  });

  it('createCinema posts to /cinema', async () => {
    const payload = { name: 'A', address: 'B', city: 'C' } as any;
    await ownerApi.createCinema(payload);
    expect(postMock).toHaveBeenCalledWith('/cinema', payload);
  });

  it('updateCinema puts /cinema/:id', async () => {
    await ownerApi.updateCinema(1, { name: 'New' });
    expect(putMock).toHaveBeenCalledWith('/cinema/1', { name: 'New' });
  });

  it('getRoomsByCinema gets /room with cinemaId param', async () => {
    await ownerApi.getRoomsByCinema(1, { limit: 100 } as any);
    expect(getMock).toHaveBeenCalledWith('/room', { params: { cinemaId: 1, limit: 100 } });
  });

  it('createRoom posts to /room', async () => {
    const payload = { name: 'Room 1', cinema_id: 1 };
    await ownerApi.createRoom(payload);
    expect(postMock).toHaveBeenCalledWith('/room', payload);
  });

  it('updateRoom puts /room/:id', async () => {
    await ownerApi.updateRoom(1, { name: 'New' });
    expect(putMock).toHaveBeenCalledWith('/room/1', { name: 'New' });
  });

  it('deleteRoom deletes /room/:id', async () => {
    await ownerApi.deleteRoom(1);
    expect(deleteMock).toHaveBeenCalledWith('/room/1');
  });

  it('getSeatsByRoom gets /seat/room/:id', async () => {
    await ownerApi.getSeatsByRoom(1);
    expect(getMock).toHaveBeenCalledWith('/seat/room/1');
  });

  it('generateSeatMap posts to /seat/room/:id/generate', async () => {
    const payload = { rows: ['A'], seatsPerRow: 5 } as any;
    await ownerApi.generateSeatMap(1, payload);
    expect(postMock).toHaveBeenCalledWith('/seat/room/1/generate', payload);
  });

  it('updateSeat puts /seat/:id', async () => {
    await ownerApi.updateSeat(1, { is_locked: true });
    expect(putMock).toHaveBeenCalledWith('/seat/1', { is_locked: true });
  });

  it('getOwnerCombos gets /combo with cinemaId param', async () => {
    await ownerApi.getOwnerCombos(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/combo', { params: { cinemaId: 1, page: 1 } });
  });

  it('createCombo posts to /combo', async () => {
    const payload = { name: 'Combo', price: 1000 } as any;
    await ownerApi.createCombo(payload);
    expect(postMock).toHaveBeenCalledWith('/combo', payload);
  });

  it('updateCombo puts /combo/:id', async () => {
    await ownerApi.updateCombo(1, { active: false });
    expect(putMock).toHaveBeenCalledWith('/combo/1', { active: false });
  });

  it('deleteCombo deletes /combo/:id', async () => {
    await ownerApi.deleteCombo(1);
    expect(deleteMock).toHaveBeenCalledWith('/combo/1');
  });

  it('getOwnerVouchers gets /voucher with cinemaId param', async () => {
    await ownerApi.getOwnerVouchers(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/voucher', { params: { cinemaId: 1, page: 1 } });
  });

  it('createVoucher posts to /voucher', async () => {
    const payload = { code: 'A', discount_type: 'fixed', discount_value: 1000 } as any;
    await ownerApi.createVoucher(payload);
    expect(postMock).toHaveBeenCalledWith('/voucher', payload);
  });

  it('updateVoucher puts /voucher/:id', async () => {
    await ownerApi.updateVoucher(1, { active: false });
    expect(putMock).toHaveBeenCalledWith('/voucher/1', { active: false });
  });

  it('deleteVoucher deletes /voucher/:id', async () => {
    await ownerApi.deleteVoucher(1);
    expect(deleteMock).toHaveBeenCalledWith('/voucher/1');
  });

  it('getOwnerDashboard gets /owner/dashboard with cinemaId param', async () => {
    await ownerApi.getOwnerDashboard(1);
    expect(getMock).toHaveBeenCalledWith('/owner/dashboard', { params: { cinemaId: 1 } });
  });

  it('lookupInvoiceByCode gets /invoice/lookup/:code', async () => {
    await ownerApi.lookupInvoiceByCode('ABC');
    expect(getMock).toHaveBeenCalledWith('/invoice/lookup/ABC');
  });

  it('getMyEmployees gets /employee with cinemaId param', async () => {
    await ownerApi.getMyEmployees(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/employee', { params: { cinemaId: 1, page: 1 } });
  });

  it('createEmployee posts to /employee', async () => {
    const payload = { cinema_id: 1, email: 'a@b.com', password: 'pw', name: 'A', phone: '', position: '' } as any;
    await ownerApi.createEmployee(payload);
    expect(postMock).toHaveBeenCalledWith('/employee', payload);
  });

  it('updateEmployee puts /employee/:id', async () => {
    await ownerApi.updateEmployee(1, { status: 0 });
    expect(putMock).toHaveBeenCalledWith('/employee/1', { status: 0 });
  });

  it('deactivateEmployee deletes /employee/:id', async () => {
    await ownerApi.deactivateEmployee(1);
    expect(deleteMock).toHaveBeenCalledWith('/employee/1');
  });
});
