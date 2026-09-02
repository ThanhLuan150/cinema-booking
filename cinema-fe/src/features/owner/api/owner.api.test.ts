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

  it('updateCinema puts /cinema/:id', async () => {
    await ownerApi.updateCinema(1, { name: 'New' });
    expect(putMock).toHaveBeenCalledWith('/cinema/1', { name: 'New' });
  });

  it('getRoomsByCinema gets /room with branchId param', async () => {
    await ownerApi.getRoomsByCinema(1, { limit: 100 } as any);
    expect(getMock).toHaveBeenCalledWith('/room', { params: { branchId: 1, limit: 100 } });
  });

  it('createRoom posts to /room', async () => {
    const payload = { name: 'Room 1', cinema_id: 1, code: 'R1', type: '2D', capacity: 40 };
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
    await ownerApi.updateSeat(1, { status: 'DISABLED' });
    expect(putMock).toHaveBeenCalledWith('/seat/1', { status: 'DISABLED' });
  });

  it('getOwnerCombos gets /combo with branchId param', async () => {
    await ownerApi.getOwnerCombos(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/combo', { params: { branchId: 1, page: 1 } });
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

  it('getOwnerInventory gets /inventory with branchId param', async () => {
    await ownerApi.getOwnerInventory(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/inventory', { params: { branchId: 1, page: 1 } });
  });

  it('getInventoryAlerts gets /inventory/alerts', async () => {
    await ownerApi.getInventoryAlerts(1);
    expect(getMock).toHaveBeenCalledWith('/inventory/alerts', { params: { branchId: 1 } });
  });

  it('getInventoryHistory gets /inventory/:id/history', async () => {
    await ownerApi.getInventoryHistory(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/inventory/1/history', { params: { page: 1 } });
  });

  it('createInventory posts to /inventory', async () => {
    const payload = { branch_id: 1, item: 'Popcorn', combo_id: null, quantity: 10, minimum_quantity: 5, unit: 'pcs' };
    await ownerApi.createInventory(payload);
    expect(postMock).toHaveBeenCalledWith('/inventory', payload);
  });

  it('updateInventory puts /inventory/:id', async () => {
    await ownerApi.updateInventory(1, { unit: 'kg' });
    expect(putMock).toHaveBeenCalledWith('/inventory/1', { unit: 'kg' });
  });

  it('deleteInventory deletes /inventory/:id', async () => {
    await ownerApi.deleteInventory(1);
    expect(deleteMock).toHaveBeenCalledWith('/inventory/1');
  });

  it('receiveInventory posts to /inventory/:id/receive', async () => {
    await ownerApi.receiveInventory(1, { quantity: 10, reason: 'restock' });
    expect(postMock).toHaveBeenCalledWith('/inventory/1/receive', { quantity: 10, reason: 'restock' });
  });

  it('adjustInventory posts to /inventory/:id/adjust', async () => {
    await ownerApi.adjustInventory(1, { quantity: 8 });
    expect(postMock).toHaveBeenCalledWith('/inventory/1/adjust', { quantity: 8 });
  });

  it('deductInventory posts to /inventory/:id/deduct', async () => {
    await ownerApi.deductInventory(1, { quantity: 2, reason: 'spoiled' });
    expect(postMock).toHaveBeenCalledWith('/inventory/1/deduct', { quantity: 2, reason: 'spoiled' });
  });

  it('getOwnerVouchers gets /voucher with branchId param', async () => {
    await ownerApi.getOwnerVouchers(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/voucher', { params: { branchId: 1, page: 1 } });
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

  it('getOwnerPricingRules gets /pricingRule with branchId param', async () => {
    await ownerApi.getOwnerPricingRules(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/pricingRule', { params: { branchId: 1, page: 1 } });
  });

  it('createPricingRule posts to /pricingRule', async () => {
    const payload = { name: 'A', price: 80000 } as any;
    await ownerApi.createPricingRule(payload);
    expect(postMock).toHaveBeenCalledWith('/pricingRule', payload);
  });

  it('updatePricingRule puts /pricingRule/:id', async () => {
    await ownerApi.updatePricingRule(1, { active: false });
    expect(putMock).toHaveBeenCalledWith('/pricingRule/1', { active: false });
  });

  it('deletePricingRule deletes /pricingRule/:id', async () => {
    await ownerApi.deletePricingRule(1);
    expect(deleteMock).toHaveBeenCalledWith('/pricingRule/1');
  });

  it('getOwnerPromotions gets /promotion with branchId param', async () => {
    await ownerApi.getOwnerPromotions(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/promotion', { params: { branchId: 1, page: 1 } });
  });

  it('createPromotion posts to /promotion', async () => {
    const payload = { code: 'A', name: 'A', discount_type: 'FIXED_AMOUNT', discount_value: 1000 } as any;
    await ownerApi.createPromotion(payload);
    expect(postMock).toHaveBeenCalledWith('/promotion', payload);
  });

  it('updatePromotion puts /promotion/:id', async () => {
    await ownerApi.updatePromotion(1, { status: 'INACTIVE' });
    expect(putMock).toHaveBeenCalledWith('/promotion/1', { status: 'INACTIVE' });
  });

  it('deletePromotion deletes /promotion/:id', async () => {
    await ownerApi.deletePromotion(1);
    expect(deleteMock).toHaveBeenCalledWith('/promotion/1');
  });

  it('getOwnerHolidays gets /pricingHoliday with branchId param', async () => {
    await ownerApi.getOwnerHolidays(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/pricingHoliday', { params: { branchId: 1, page: 1 } });
  });

  it('createHoliday posts to /pricingHoliday', async () => {
    const payload = { date: '2026-12-25', name: 'Christmas', branch_id: null } as any;
    await ownerApi.createHoliday(payload);
    expect(postMock).toHaveBeenCalledWith('/pricingHoliday', payload);
  });

  it('deleteHoliday deletes /pricingHoliday/:id', async () => {
    await ownerApi.deleteHoliday(1);
    expect(deleteMock).toHaveBeenCalledWith('/pricingHoliday/1');
  });

  it('lookupInvoiceByCode gets /invoice/lookup/:code', async () => {
    await ownerApi.lookupInvoiceByCode('ABC');
    expect(getMock).toHaveBeenCalledWith('/invoice/lookup/ABC');
  });

  it('getMyEmployees gets /employee with branchId param', async () => {
    await ownerApi.getMyEmployees(1, { page: 1 } as any);
    expect(getMock).toHaveBeenCalledWith('/employee', { params: { branchId: 1, page: 1 } });
  });

  it('createEmployee posts to /employee', async () => {
    const payload = { cinema_id: 1, email: 'a@b.com', password: 'pw', name: 'A', phone: '', position_id: 1 } as any;
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

  it('resetEmployeePassword posts to /employee/:id/reset-password', async () => {
    await ownerApi.resetEmployeePassword(1);
    expect(postMock).toHaveBeenCalledWith('/employee/1/reset-password');
  });

  it('getPositions gets /position', async () => {
    await ownerApi.getPositions();
    expect(getMock).toHaveBeenCalledWith('/position');
  });

  it('getMaintenanceRequests gets /maintenance with branchId param', async () => {
    await ownerApi.getMaintenanceRequests(1, { page: 1, limit: 20 });
    expect(getMock).toHaveBeenCalledWith('/maintenance', { params: { branchId: 1, page: 1, limit: 20 } });
  });

  it('createMaintenanceRequest posts to /maintenance', async () => {
    const payload = { branch_id: 1, resource_type: 'ROOM' as const, room_id: 1, title: 'Flicker' };
    await ownerApi.createMaintenanceRequest(payload);
    expect(postMock).toHaveBeenCalledWith('/maintenance', payload);
  });

  it('assignMaintenanceRequest posts to /maintenance/:id/assign', async () => {
    await ownerApi.assignMaintenanceRequest(1, { employee_id: 5 });
    expect(postMock).toHaveBeenCalledWith('/maintenance/1/assign', { employee_id: 5 });
  });

  it('startMaintenanceRequest posts to /maintenance/:id/start', async () => {
    await ownerApi.startMaintenanceRequest(1);
    expect(postMock).toHaveBeenCalledWith('/maintenance/1/start');
  });

  it('resolveMaintenanceRequest posts to /maintenance/:id/resolve', async () => {
    await ownerApi.resolveMaintenanceRequest(1, { resolution_note: 'Fixed it' });
    expect(postMock).toHaveBeenCalledWith('/maintenance/1/resolve', { resolution_note: 'Fixed it' });
  });

  it('closeMaintenanceRequest posts to /maintenance/:id/close', async () => {
    await ownerApi.closeMaintenanceRequest(1);
    expect(postMock).toHaveBeenCalledWith('/maintenance/1/close');
  });

  it('deleteMaintenanceRequest deletes /maintenance/:id', async () => {
    await ownerApi.deleteMaintenanceRequest(1);
    expect(deleteMock).toHaveBeenCalledWith('/maintenance/1');
  });
});
