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

export interface MovieReviewPayload {
  movie_id: number;
  rating: number;
  comment: string;
}

export interface MovieReplyPayload {
  movie_id: number;
  parent_id: number;
  comment: string;
}

export interface MovieReviewUpdatePayload {
  rating?: number;
  comment: string;
}
