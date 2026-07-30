import apiClient from 'services/apiClient';
import type { ReactionType } from '@/components/reviews/reactions';
import type {
  MovieReplyPayload,
  MovieReviewPayload,
  MovieReviewUpdatePayload,
  ReviewsResponse,
} from '../types/movieDetail.types';

export const getMovieReviews = (movieId: string | number) =>
  apiClient.get<ReviewsResponse>(`/review/${movieId}`).then((res) => res.data);

export const postMovieReview = (payload: MovieReviewPayload) => apiClient.post('/review', payload);

export const postMovieReply = (payload: MovieReplyPayload) => apiClient.post('/review', payload);

export const postReviewReaction = (reviewId: number, type: ReactionType) =>
  apiClient.post(`/review/${reviewId}/react`, { type });

export const updateReview = (reviewId: number, payload: MovieReviewUpdatePayload) =>
  apiClient.put(`/review/${reviewId}`, payload);

export const deleteReview = (reviewId: number) => apiClient.delete(`/review/${reviewId}`);

export const reportReview = (reviewId: number, reason: string) =>
  apiClient.post(`/review/${reviewId}/report`, { reason });
