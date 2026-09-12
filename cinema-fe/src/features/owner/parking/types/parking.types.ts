import type { ParkingAreaStatus, ParkingSlotStatus, ParkingVehicleType } from '@/types/entities';

export interface AreaForm {
  name: string;
  capacity: string;
  status: ParkingAreaStatus;
}

export interface EntryForm {
  vehicle_type: ParkingVehicleType;
  vehicle_plate: string;
  slot_id: string;
}

export interface SlotForm {
  slot_code: string;
  vehicle_type: ParkingVehicleType;
  status: ParkingSlotStatus;
}
