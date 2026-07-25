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

export interface MovieReviewPayload {
  movie_id: number;
  rating: number;
  comment: string;
}
