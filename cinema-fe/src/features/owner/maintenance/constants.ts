import { MAINTENANCE_RESOURCE_TYPE } from '@/constants/maintenanceResourceType';
import type { MaintenanceStatus } from '@/types/entities';
import type { MaintenanceRequestFormValues } from '../types/owner.types';

export const ALL_BRANCHES = 'ALL';
export const ROOM_LIKE_TYPES: string[] = [MAINTENANCE_RESOURCE_TYPE.ROOM, MAINTENANCE_RESOURCE_TYPE.SEAT];

export const STATUS_VARIANT: Record<MaintenanceStatus, 'warning' | 'outline' | 'accent' | 'success' | 'default'> = {
  OPEN: 'warning',
  ASSIGNED: 'outline',
  IN_PROGRESS: 'accent',
  RESOLVED: 'success',
  CLOSED: 'default',
};

export function emptyForm(branchId: string): MaintenanceRequestFormValues {
  return {
    branch_id: branchId === ALL_BRANCHES ? '' : branchId,
    resource_type: MAINTENANCE_RESOURCE_TYPE.ROOM,
    room_id: '',
    seat_id: '',
    resource_name: '',
    title: '',
    description: '',
  };
}
