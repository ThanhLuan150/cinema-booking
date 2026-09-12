import type { DeviceStatus, EntranceStatus } from '@/types/entities';

export interface DeviceForm {
  device_id: string;
  name: string;
  entrance_id: string;
  status: DeviceStatus;
}

export interface EntranceForm {
  name: string;
  code: string;
  status: EntranceStatus;
}
