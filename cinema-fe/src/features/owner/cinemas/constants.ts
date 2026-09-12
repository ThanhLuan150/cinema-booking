import type { BadgeVariant } from '@/components/ui/Badge';
import type { RoomFormValues, SeatMapFormValues } from '../types/owner.types';

export const emptyRoomForm = (): RoomFormValues => ({ name: '', code: '', type: '2D', capacity: '' });

export const emptySeatMapForm = (): SeatMapFormValues => ({
  rowsInput: 'A,B,C,D,E',
  seatsPerRow: '8',
  vipRows: 'A',
  coupleRows: '',
});

export const ROOM_STATUS_BADGE: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  MAINTENANCE: 'warning',
  CLOSED: 'default',
};
