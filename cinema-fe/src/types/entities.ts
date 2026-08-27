import type { DISCOUNT_TYPE } from '@/constants/discountType';
import type { PROMOTION_DISCOUNT_TYPE } from '@/constants/promotionDiscountType';

export interface Movie {
  id: number;
  owner_id?: number | null;
  status?: 'ACTIVE' | 'INACTIVE';
  name: string;
  avatar: string;
  duration?: number;
  premiere_date: string;
  description: string;
  country: string;
  trailer: string;
  producer?: string;
  producerAvatar?: string;
  categories?: Category[];
  actors?: MovieActor[];
  directors?: Director[];
  createdAt?: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface MovieCategory {
  id: number;
  movie_id: number;
  cat_id: number;
}

// Raw join-table record from GET /movieActor/:movieId (as opposed to `MovieActor` below,
// which is the actor profile already populated onto `Movie.actors` by the backend).
export interface MovieActorLink {
  id: number;
  movie_id: number;
  actor_id: number;
  character_name: string;
  is_lead: boolean;
}

// Raw join-table record from GET /movieDirector/:movieId.
export interface MovieDirectorLink {
  id: number;
  movie_id: number;
  director_id: number;
}

export interface Room {
  id: number;
  cinema_id: number;
  name: string;
  code: string;
  type: '2D' | '3D' | 'IMAX' | 'VIP';
  capacity: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'CLOSED';
}

export interface Cinema {
  id: number;
  owner_id: number;
  name: string;
  address: string;
  city: string;
  images: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  owner_name?: string;
  owner_phone?: string;
  owner_avatar?: string;
}

export interface Seat {
  id: number;
  room_id: number;
  row: string;
  number: number;
  seat_code: string;
  seat_type: number; // 0 = regular, 1 = vip, 2 = couple
  status: 'ACTIVE' | 'DISABLED';
}

export type ComboType = 'FOOD' | 'BEVERAGE' | 'COMBO';

export interface ComboComponentItem {
  item_id: number;
  quantity: number;
}

export interface Combo {
  id: number;
  cinema_id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  active: boolean;
  type: ComboType;
  items: ComboComponentItem[];
}

export type InventoryStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Inventory {
  id: number;
  branch_id: number;
  combo_id: number | null;
  item: string;
  quantity: number;
  minimum_quantity: number;
  unit: string;
  status: InventoryStatus;
}

export type InventoryTransactionType = 'RECEIVE' | 'ADJUST' | 'DEDUCT';

export interface InventoryTransaction {
  id: number;
  inventory_id: number;
  branch_id: number;
  type: InventoryTransactionType;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  ref_type: string | null;
  ref_code: string | null;
  performed_by: number | null;
  createdAt: string;
}

export interface Promotion {
  id: number;
  code: string;
  name: string;
  description: string;
  discount_type: (typeof PROMOTION_DISCOUNT_TYPE)[keyof typeof PROMOTION_DISCOUNT_TYPE];
  discount_value: number;
  minimum_order_value: number;
  maximum_discount: number | null;
  start_at: string;
  end_at: string;
  usage_limit: number | null;
  used_count: number;
  per_customer_limit: number | null;
  status: 'ACTIVE' | 'INACTIVE';
  branch_ids: number[];
  movie_ids: number[];
  showtime_ids: number[];
  combo_ids: number[];
}

export interface Voucher {
  id: number;
  cinema_id: number | null;
  code: string;
  discount_type: (typeof DISCOUNT_TYPE)[keyof typeof DISCOUNT_TYPE];
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_to: string | null;
  min_order_value: number;
  active: boolean;
}

export interface PricingRule {
  id: number;
  name: string;
  price: number;
  priority: number;
  active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  branch_id: number | null;
  room_type: string | null;
  seat_type: number | null;
  category_id: number | null;
  day_type: string | null;
  time_start: string | null;
  time_end: string | null;
  membership_level: string | null;
}

export interface Holiday {
  id: number;
  date: string;
  name: string;
  branch_id: number | null;
}

export interface Review {
  id: number;
  movie_id: number;
  account_id: number;
  rating: number;
  comment: string;
  hidden: boolean;
  createdAt: string;
}

export interface Schedule {
  id: number;
  movie_id: number;
  room_id: number;
  movie_date: string;
  time_begin: string;
  time_end: string;
  price: number;
}

export interface Position {
  id: number;
  code: string;
  name: string;
  status?: number; // 1 = active, 0 = inactive
}

export interface Employee {
  id: number;
  user_id: number;
  branch_id: number;
  employee_code: string;
  position_id: number;
  position?: { code: string; name: string };
  hire_date: string;
  status: number; // 1 = active, 0 = deactivated
  email?: string;
  name?: string;
  phone?: string;
}

export interface Shift {
  id: number;
  branch_id: number;
  name: string;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ShiftAssignment {
  id: number;
  employee_id: number;
  shift_id: number;
  branch_id: number;
  date: string; // YYYY-MM-DD
  start_at: string; // ISO datetime
  end_at: string; // ISO datetime
  status: 'ACTIVE' | 'CANCELLED';
  // Only populated by GET /api/shiftAssignment/me — employees don't hold shift.read to look
  // this up themselves, so the backend nests a read-only summary onto each of their own rows.
  shift?: { name: string; start_time: string; end_time: string };
}

export type MaintenanceResourceType =
  | 'ROOM'
  | 'PROJECTOR'
  | 'SOUND_SYSTEM'
  | 'AIR_CONDITIONER'
  | 'SEAT'
  | 'QR_SCANNER'
  | 'POS'
  | 'EQUIPMENT_OTHER';

export type MaintenanceStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface MaintenanceRequest {
  id: number;
  branch_id: number;
  resource_type: MaintenanceResourceType;
  room_id: number | null;
  seat_id: number | null;
  resource_name: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  reported_by: number;
  assigned_employee_id: number | null;
  assigned_at: string | null;
  started_at: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  closed_at: string | null;
  createdAt: string;
}

export type SupportTicketCategory = 'GENERAL' | 'COMPLAINT' | 'BOOKING_SUPPORT' | 'REFUND_SUPPORT' | 'SHOWTIME_CHANGE';
export type SupportTicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface SupportTicket {
  id: number;
  customer_id: number;
  branch_id: number;
  category: SupportTicketCategory;
  subject: string;
  description: string;
  status: SupportTicketStatus;
  created_by: number;
  assigned_employee_id: number | null;
  assigned_at: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  createdAt: string;
}

// Ticket 23 — QR scanner device management
export type EntranceStatus = 'ACTIVE' | 'INACTIVE';

export interface Entrance {
  id: number;
  branch_id: number;
  name: string;
  code: string;
  status: EntranceStatus;
  createdAt: string;
}

export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';

export interface Device {
  id: number;
  device_id: string;
  name: string;
  branch_id: number;
  entrance_id: number | null;
  status: DeviceStatus;
  last_seen_at: string | null;
  createdAt: string;
}

// Only ever present on the create / rotate-key responses — the plaintext key is shown once.
export interface DeviceWithKey extends Device {
  api_key: string;
}

export type CheckinResult = 'SUCCESS' | 'REJECTED';

export interface CheckinLog {
  id: number;
  device_id: number | null;
  entrance_id: number | null;
  branch_id: number;
  invoice_id: number | null;
  qr_token: string | null;
  checked_in_by: number | null;
  checked_in_at: string;
  result: CheckinResult;
  reason: string | null;
  createdAt: string;
}

// Ticket 24 — Audit Log
export type AuditLogEntityType =
  | 'BRANCH'
  | 'EMPLOYEE'
  | 'MOVIE'
  | 'SCHEDULE'
  | 'BOOKING'
  | 'PAYMENT'
  | 'REFUND'
  | 'TICKET';

export interface AuditLog {
  id: number;
  entity_type: AuditLogEntityType;
  entity_id: number;
  action: string;
  /** actor account id — `user_id` is the spec alias of `performed_by`; both are sent */
  performed_by: number | null;
  user_id: number | null;
  branch_id: number | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogMeta {
  actions: string[];
  entityTypes: AuditLogEntityType[];
}

export interface Actor {
  id: number;
  full_name: string;
  avatar_url: string;
  bio: string;
  dob: string | null;
  nationality: string;
}

export interface MovieActor extends Actor {
  character_name?: string;
  is_lead?: boolean;
}

export interface Director {
  id: number;
  full_name: string;
  avatar_url: string;
  bio: string;
  dob: string | null;
  nationality: string;
}

export interface User {
  id: number;
  name: string;
  phone: string;
  email: string;
  role: number;
  status: number;
  approved: boolean;
}

export interface Account {
  id: number;
  email: string;
}
