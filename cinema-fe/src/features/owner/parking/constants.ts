import type { ParkingAreaStatus, ParkingSlotStatus, ParkingTicketStatus, ParkingVehicleType } from '@/types/entities';
import type { AreaForm, EntryForm, SlotForm } from './types/parking.types';

export const ALL_BRANCHES = 'ALL';

export const AREA_STATUSES: ParkingAreaStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
export const SLOT_STATUSES: ParkingSlotStatus[] = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];
export const VEHICLE_TYPES: ParkingVehicleType[] = ['CAR', 'MOTORBIKE', 'BICYCLE', 'OTHER'];
export const TICKET_STATUSES: ParkingTicketStatus[] = ['ACTIVE', 'PENDING_PAYMENT', 'COMPLETED', 'CANCELLED'];

export const AREA_STATUS_VARIANT: Record<ParkingAreaStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};
export const SLOT_STATUS_VARIANT: Record<ParkingSlotStatus, 'success' | 'warning' | 'default'> = {
  AVAILABLE: 'success',
  OCCUPIED: 'warning',
  RESERVED: 'default',
  MAINTENANCE: 'default',
};
export const TICKET_STATUS_VARIANT: Record<ParkingTicketStatus, 'success' | 'warning' | 'default'> = {
  ACTIVE: 'warning',
  PENDING_PAYMENT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
};

export const emptyAreaForm: AreaForm = { name: '', capacity: '0', status: 'ACTIVE' };
export const emptyEntryForm: EntryForm = { vehicle_type: 'CAR', vehicle_plate: '', slot_id: '' };
export const emptySlotForm: SlotForm = { slot_code: '', vehicle_type: 'CAR', status: 'AVAILABLE' };
