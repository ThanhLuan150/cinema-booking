export interface ReviewItem {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewsResponse {
  reviews: ReviewItem[];
  average: number;
  count: number;
}

export interface CinemaReviewPayload {
  cinema_id: number;
  rating: number;
  comment: string;
}
