import apiClient from 'services/apiClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import type {
  Cinema,
  EventPackage,
  EventPackageStatus,
  PrivateEvent,
  PrivateEventStatus,
  Room,
} from '@/types/entities';

// ---- Reference data the request wizard needs -------------------------

export const getRentalBranches = () =>
  apiClient
    .get<PaginatedResponse<Cinema>>('/cinema', { params: { limit: 200 } })
    .then((res) => res.data.data);

export const getBranchRooms = (branchId: number | string) =>
  apiClient
    .get<PaginatedResponse<Room>>('/room', { params: { branchId, limit: 200 } })
    .then((res) => res.data.data);

// Ticket 40 — one API module for the whole Private Event / Cinema Rental flow. The customer
// pages use the request / mine / pay / cancel calls; the owner review page uses the list /
// quote / approve / confirm / complete / reject calls. Packages are read by everyone and
// written only by SUPER_ADMIN.

// ---- Packages -----------------------------------------------------------

export const getEventPackages = (params?: PaginationParams & { status?: EventPackageStatus }) =>
  apiClient
    .get<PaginatedResponse<EventPackage>>('/private-events/packages', { params })
    .then((res) => res.data);

export interface EventPackagePayload {
  name?: string;
  code?: string;
  description?: string;
  base_price?: number;
  max_guests?: number;
  duration_hours?: number;
  perks?: string[];
  status?: EventPackageStatus;
}

export const createEventPackage = (payload: EventPackagePayload) =>
  apiClient.post<EventPackage>('/private-events/packages', payload).then((res) => res.data);

export const updateEventPackage = (id: number | string, payload: EventPackagePayload) =>
  apiClient.put(`/private-events/packages/${id}`, payload);

export const deleteEventPackage = (id: number | string) =>
  apiClient.delete(`/private-events/packages/${id}`);

// ---- Customer flow ----------------------------------------------------

export interface PrivateEventRequestPayload {
  branch_id: number;
  room_id: number;
  package_id: number;
  start_at: string;
  end_at: string;
  guest_count: number;
  title?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  notes?: string;
}

export const requestPrivateEvent = (payload: PrivateEventRequestPayload) =>
  apiClient.post<PrivateEvent>('/private-events', payload).then((res) => res.data);

export const getMyPrivateEvents = (params?: PaginationParams & { status?: PrivateEventStatus }) =>
  apiClient
    .get<PaginatedResponse<PrivateEvent>>('/private-events/mine', { params })
    .then((res) => res.data);

export const getPrivateEvent = (id: number | string) =>
  apiClient.get<PrivateEvent>(`/private-events/${id}`).then((res) => res.data);

export const payPrivateEvent = (id: number | string) =>
  apiClient.post<PrivateEvent>(`/private-events/${id}/pay`).then((res) => res.data);

export const cancelMyPrivateEvent = (id: number | string, reason?: string) =>
  apiClient.post<PrivateEvent>(`/private-events/${id}/cancel`, { reason }).then((res) => res.data);

// ---- Admin review flow --------------------------------------------

export const getPrivateEvents = (
  branchId: number | string | undefined,
  params?: PaginationParams & { status?: PrivateEventStatus },
) =>
  apiClient
    .get<PaginatedResponse<PrivateEvent>>('/private-events', { params: { branchId, ...params } })
    .then((res) => res.data);

export const quotePrivateEvent = (id: number | string, quoted_amount: number, quote_notes?: string) =>
  apiClient
    .post<PrivateEvent>(`/private-events/${id}/quote`, { quoted_amount, quote_notes })
    .then((res) => res.data);

export const approvePrivateEvent = (id: number | string) =>
  apiClient.post<PrivateEvent>(`/private-events/${id}/approve`).then((res) => res.data);

export const confirmPrivateEvent = (id: number | string) =>
  apiClient.post<PrivateEvent>(`/private-events/${id}/confirm`).then((res) => res.data);

export const completePrivateEvent = (id: number | string) =>
  apiClient.post<PrivateEvent>(`/private-events/${id}/complete`).then((res) => res.data);

export const rejectPrivateEvent = (id: number | string, reason?: string) =>
  apiClient.post<PrivateEvent>(`/private-events/${id}/reject`, { reason }).then((res) => res.data);
