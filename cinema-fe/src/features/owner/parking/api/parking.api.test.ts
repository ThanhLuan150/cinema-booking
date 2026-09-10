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

import * as parkingApi from './parking.api';

describe('parking.api', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    putMock.mockReset();
    deleteMock.mockReset();
    getMock.mockResolvedValue({ data: {} });
    postMock.mockResolvedValue({ data: {} });
  });

  it('getParkingAreas gets /parking/areas with branchId + params', async () => {
    await parkingApi.getParkingAreas(1, { page: 1, status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/parking/areas', { params: { branchId: 1, page: 1, status: 'ACTIVE' } });
  });

  it('createParkingArea posts /parking/areas and unwraps data', async () => {
    postMock.mockResolvedValue({ data: { id: 7 } });
    const res = await parkingApi.createParkingArea({ branch_id: 1, name: 'B1', capacity: 10 });
    expect(postMock).toHaveBeenCalledWith('/parking/areas', { branch_id: 1, name: 'B1', capacity: 10 });
    expect(res.id).toBe(7);
  });

  it('getParkingSlots gets /parking/slots scoped by areaId', async () => {
    await parkingApi.getParkingSlots(9, { page: 1, status: 'AVAILABLE' });
    expect(getMock).toHaveBeenCalledWith('/parking/slots', { params: { areaId: 9, page: 1, status: 'AVAILABLE' } });
  });

  it('slot CRUD targets /parking/slots', async () => {
    postMock.mockResolvedValue({ data: { id: 1 } });
    await parkingApi.createParkingSlot({ parking_area_id: 1, slot_code: 'S-1' });
    expect(postMock).toHaveBeenCalledWith('/parking/slots', { parking_area_id: 1, slot_code: 'S-1' });
    await parkingApi.updateParkingSlot(4, { status: 'MAINTENANCE' });
    expect(putMock).toHaveBeenCalledWith('/parking/slots/4', { status: 'MAINTENANCE' });
    await parkingApi.deleteParkingSlot(4);
    expect(deleteMock).toHaveBeenCalledWith('/parking/slots/4');
  });

  it('vehicle flow hits the right ticket endpoints', async () => {
    postMock.mockResolvedValue({ data: { id: 3 } });
    await parkingApi.enterVehicle({ branch_id: 1, vehicle_type: 'CAR', vehicle_plate: 'ABC' });
    expect(postMock).toHaveBeenCalledWith('/parking/tickets', { branch_id: 1, vehicle_type: 'CAR', vehicle_plate: 'ABC' });
    await parkingApi.exitVehicle(3);
    expect(postMock).toHaveBeenCalledWith('/parking/tickets/3/exit');
    await parkingApi.payParkingTicket(3);
    expect(postMock).toHaveBeenCalledWith('/parking/tickets/3/payment');
    await parkingApi.cancelParkingTicket(3);
    expect(postMock).toHaveBeenCalledWith('/parking/tickets/3/cancel');
  });

  it('getParkingTickets gets /parking/tickets with status filter', async () => {
    await parkingApi.getParkingTickets(2, { status: 'ACTIVE' });
    expect(getMock).toHaveBeenCalledWith('/parking/tickets', { params: { branchId: 2, status: 'ACTIVE' } });
  });
});
