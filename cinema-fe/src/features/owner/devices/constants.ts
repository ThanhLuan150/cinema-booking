import type { DeviceStatus, EntranceStatus } from '@/types/entities';
import type { DeviceForm, EntranceForm } from './types/devices.types';

export const ALL_BRANCHES = 'ALL';

export const DEVICE_STATUSES: DeviceStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];
export const ENTRANCE_STATUSES: EntranceStatus[] = ['ACTIVE', 'INACTIVE'];

export const DEVICE_STATUS_VARIANT: Record<DeviceStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};

export const emptyDeviceForm: DeviceForm = { device_id: '', name: '', entrance_id: '', status: 'ACTIVE' };
export const emptyEntranceForm: EntranceForm = { name: '', code: '', status: 'ACTIVE' };
