import type { KioskStatus } from '@/types/entities';
import type { KioskForm } from '../types/owner.types';

export const ALL_BRANCHES = 'ALL';

export const KIOSK_STATUSES: KioskStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

export const KIOSK_STATUS_VARIANT: Record<KioskStatus, 'success' | 'default' | 'warning'> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
};

export const emptyKioskForm: KioskForm = { kiosk_code: '', name: '', status: 'ACTIVE' };
