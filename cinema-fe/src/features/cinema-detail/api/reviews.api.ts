import apiClient from 'services/apiClient';
import type { CinemaReviewPayload, ReviewsResponse } from '../types/cinemaDetail.types';

export const getCinemaReviews = (cinemaId: string | number) =>
  apiClient.get<ReviewsResponse>(`/review/cinema/${cinemaId}`).then((res) => res.data);

export const postCinemaReview = (payload: CinemaReviewPayload) => apiClient.post('/review', payload);
