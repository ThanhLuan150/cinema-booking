import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  ParkingArea,
  ParkingAreaStatus,
  ParkingSlot,
  ParkingSlotStatus,
  ParkingTicket,
  ParkingTicketStatus,
  ParkingVehicleType,
} from '@/types/entities';

// ---- Parking areas --------------------------------------------------------

export const getParkingAreas = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: ParkingAreaStatus },
) =>
  apiClient
    .get<PaginatedResponse<ParkingArea>>('/parking/areas', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface ParkingAreaPayload {
  branch_id?: number;
  name?: string;
  capacity?: number;
  status?: ParkingAreaStatus;
}

export const createParkingArea = (payload: ParkingAreaPayload) =>
  apiClient.post<ParkingArea>('/parking/areas', payload).then((res) => res.data);

export const updateParkingArea = (id: number | string, payload: ParkingAreaPayload) =>
  apiClient.put(`/parking/areas/${id}`, payload);

export const deleteParkingArea = (id: number | string) => apiClient.delete(`/parking/areas/${id}`);

// ---- Parking slots ------------------------------------------------------

export const getParkingSlots = (
  areaId: number | string | undefined,
  params?: PaginationParams & {
    branchId?: number | string;
    vehicleType?: ParkingVehicleType;
    status?: ParkingSlotStatus;
  },
) =>
  apiClient
    .get<PaginatedResponse<ParkingSlot>>('/parking/slots', { params: { areaId, ...params } })
    .then((res) => res.data);

export interface ParkingSlotPayload {
  parking_area_id?: number;
  slot_code?: string;
  vehicle_type?: ParkingVehicleType;
  status?: ParkingSlotStatus;
}

export const createParkingSlot = (payload: ParkingSlotPayload) =>
  apiClient.post<ParkingSlot>('/parking/slots', payload).then((res) => res.data);

export const updateParkingSlot = (id: number | string, payload: ParkingSlotPayload) =>
  apiClient.put(`/parking/slots/${id}`, payload);

export const deleteParkingSlot = (id: number | string) => apiClient.delete(`/parking/slots/${id}`);

// ---- Parking tickets (vehicle flow) ----------------------------------------

export const getParkingTickets = (
  branchId: number | string | undefined,
  params?: PaginationParams & {
    status?: ParkingTicketStatus;
    slotId?: number | string;
    plate?: string;
  },
) =>
  apiClient
    .get<PaginatedResponse<ParkingTicket>>('/parking/tickets', { params: { branchId, ...params } })
    .then((res) => res.data);

export interface VehicleEntryPayload {
  branch_id: number;
  vehicle_type: ParkingVehicleType;
  vehicle_plate: string;
  slot_id?: number | null;
}

export const enterVehicle = (payload: VehicleEntryPayload) =>
  apiClient.post<ParkingTicket>('/parking/tickets', payload).then((res) => res.data);

export const exitVehicle = (id: number | string) =>
  apiClient.post<ParkingTicket>(`/parking/tickets/${id}/exit`).then((res) => res.data);

export const payParkingTicket = (id: number | string) =>
  apiClient.post<ParkingTicket>(`/parking/tickets/${id}/payment`).then((res) => res.data);

export const cancelParkingTicket = (id: number | string) =>
  apiClient.post<ParkingTicket>(`/parking/tickets/${id}/cancel`).then((res) => res.data);
