export interface FavoriteGenre {
  id: number;
  name: string;
  bookings: number;
}

export interface FavoriteBranch {
  branch_id: number;
  name: string;
  bookings: number;
}

/**
 * Aggregated Customer Profile / Activity Summary. Every figure is computed on the backend
 * from booking / payment / loyalty data — the client never sends or edits these.
 *
 * `favorite_genres`, `total_combo_spending` and `lifetime_points` are omitted for
 * EMPLOYEE-role callers (a reduced field set for servicing requests), so treat them as
 * optional.
 */
export interface CustomerProfile {
  customer_id: number;
  name: string;
  email: string;
  phone: string;
  member_since: string;
  scope: 'ALL' | 'BRANCH';
  branch_ids: number[] | null;

  total_bookings: number;
  total_tickets: number;
  total_spending: number;
  total_combo_spending?: number;

  favorite_genres?: FavoriteGenre[];
  favorite_branch: FavoriteBranch | null;
  last_visit: string | null;

  membership_level: string;
  membership_level_name: string;
  loyalty_points: number;
  lifetime_points?: number;
}
