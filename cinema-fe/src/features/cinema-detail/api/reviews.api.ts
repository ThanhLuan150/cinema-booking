import apiClient from 'services/apiClient';
import type { ReactionType } from '@/components/reviews/reactions';
import type {
  CinemaReplyPayload,
  CinemaReviewPayload,
  CinemaReviewUpdatePayload,
  ReviewsResponse,
} from '../types/cinemaDetail.types';

export const getCinemaReviews = (branchId: string | number) =>
  apiClient.get<ReviewsResponse>(`/review/cinema/${branchId}`).then((res) => res.data);

export const postCinemaReview = (payload: CinemaReviewPayload) => apiClient.post('/review', payload);

export const postCinemaReply = (payload: CinemaReplyPayload) => apiClient.post('/review', payload);

export const postReviewReaction = (reviewId: number, type: ReactionType) =>
  apiClient.post(`/review/${reviewId}/react`, { type });

export const updateReview = (reviewId: number, payload: CinemaReviewUpdatePayload) =>
  apiClient.put(`/review/${reviewId}`, payload);

export const deleteReview = (reviewId: number) => apiClient.delete(`/review/${reviewId}`);

export const reportReview = (reviewId: number, reason: string) =>
  apiClient.post(`/review/${reviewId}/report`, { reason });
