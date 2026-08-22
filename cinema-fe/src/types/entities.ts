import type { DISCOUNT_TYPE } from '@/constants/discountType';

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

export interface Combo {
  id: number;
  cinema_id: number;
  name: string;
  description: string;
  price: number;
  image: string;
  active: boolean;
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
