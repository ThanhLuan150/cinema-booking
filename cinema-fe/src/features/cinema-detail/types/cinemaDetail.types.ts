import type { ReviewReactions } from '@/components/reviews/reactions';

export interface ReviewAuthor {
  id: number;
  name: string;
  avatar: string;
}

export interface ReviewReply {
  id: number;
  comment: string;
  createdAt: string;
  author: ReviewAuthor;
  reactions: ReviewReactions;
  reportedByMe: boolean;
}

export interface ReviewItem {
  id: number;
  rating: number;
  comment: string;
  createdAt: string;
  author: ReviewAuthor;
  reactions: ReviewReactions;
  replies: ReviewReply[];
  reportedByMe: boolean;
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

export interface CinemaReplyPayload {
  cinema_id: number;
  parent_id: number;
  comment: string;
}

export interface CinemaReviewUpdatePayload {
  rating?: number;
  comment: string;
}
