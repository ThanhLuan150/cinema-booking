import type { DISCOUNT_TYPE } from '@/constants/discountType';

export interface CastMember {
  name: string;
  role?: string;
  avatar?: string;
  isLead?: boolean;
}

export interface Movie {
  id: number;
  owner_id?: number | null;
  name: string;
  avatar: string;
  premiere_date: string;
  description: string;
  country: string;
  trailer: string;
  producer?: string;
  producerAvatar?: string;
  director?: string;
  directorAvatar?: string;
  cast?: CastMember[];
  categories?: Category[];
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

export interface Room {
  id: number;
  cinema_id: number;
  name: string;
}

export interface Cinema {
  id: number;
  owner_id: number;
  name: string;
  address: string;
  city: string;
  images: string[];
  status: number; // 0 = pending, 1 = approved, 2 = blocked
  owner_name?: string;
  owner_phone?: string;
  owner_avatar?: string;
}

export interface Seat {
  id: number;
  room_id: number;
  seat_code: string;
  seat_type: number; // 0 = regular, 1 = vip, 2 = couple
  is_locked: boolean;
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
